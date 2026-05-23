import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { impostazioniDocRef } from './telegramFirestore.js';
import { buildStatoChangeFields } from './missionStoricoStati.js';
import { isStatoMissioneTerminale, nextStatoMissione } from './missionStati.js';
import { syncPmappOnDirettoH } from './pmappSyncDirettoH.js';

const DEFAULT_STATI_MISSIONE = [
  'ALLERTARE',
  'ALLERTATO',
  'PARTITO',
  'IN POSTO',
  'DIRETTO H',
  'ARRIVATO H',
  'RIENTRO',
  'FINE MISSIONE',
  'ANNULLATA',
];

const ESITO_TRASPORTA = 'Trasporta';
const MEZZO_STATO_AVARIA_SINISTRO = 'Non operativo (avaria/sinistro)';

function missioniCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('missioni');
}

function mezziCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('mezzi');
}

function eventiCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('eventi');
}

function pazientiCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('pazienti');
}

export async function getStatiMissione(tenantId) {
  const snap = await impostazioniDocRef(tenantId).get();
  const list = snap.exists ? snap.data()?.statiMissione : null;
  if (Array.isArray(list) && list.length > 0) return list;
  return DEFAULT_STATI_MISSIONE;
}

export async function getMissioneById(tenantId, missionDocId) {
  const snap = await missioniCol(tenantId).doc(missionDocId).get();
  if (!snap.exists) return null;
  return { _docId: snap.id, ...snap.data() };
}

export async function listMissioniAperteByMezzo(tenantId, mezzo) {
  const snap = await missioniCol(tenantId).where('mezzo', '==', mezzo).get();
  return snap.docs
    .map((d) => ({ _docId: d.id, ...d.data() }))
    .filter(
      (m) =>
        m.aperta !== false &&
        !isStatoMissioneTerminale(m.stato) &&
        (m.stato ?? '') !== 'RIENTRO',
    )
    .sort((a, b) => String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it'));
}

async function patchMezzoAdmin(tenantId, sigla, fields) {
  if (!sigla || !fields || Object.keys(fields).length === 0) return;
  await mezziCol(tenantId).doc(sigla).set(fields, { merge: true });
}

async function syncPazientiArrivatoHAdmin(tenantId, missione) {
  if (!missione?.mezzo) return;
  const snap = await pazientiCol(tenantId).get();
  const batch = getAdminDb().batch();
  let ops = 0;

  for (const docSnap of snap.docs) {
    const p = docSnap.data();
    const sameEvento =
      (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
      p.eventoCorrelato === missione.eventoCorrelato;
    if (!sameEvento || p.mezzo !== missione.mezzo || p.esito !== ESITO_TRASPORTA) continue;
    if (p.stato === 'ARRIVATO H') continue;
    batch.update(docSnap.ref, {
      stato: 'ARRIVATO H',
      arrivatoHAt: FieldValue.serverTimestamp(),
    });
    ops += 1;
  }

  if (ops > 0) await batch.commit();
}

function isMissioneTerminata(m) {
  return m.aperta === false || isStatoMissioneTerminale(m.stato);
}

async function tryAutoCloseEventoAdmin(tenantId, eventoIdUnivoco, eventoCorrelato) {
  let missioni = [];
  if (eventoIdUnivoco) {
    const snap = await missioniCol(tenantId).where('eventoIdUnivoco', '==', eventoIdUnivoco).get();
    missioni = snap.docs.map((d) => d.data());
  } else if (eventoCorrelato) {
    const snap = await missioniCol(tenantId).where('eventoCorrelato', '==', eventoCorrelato).get();
    missioni = snap.docs.map((d) => d.data());
  }
  if (!missioni.length) return;
  if (!missioni.every(isMissioneTerminata)) return;
  if (!missioni.some((m) => m.stato === 'FINE MISSIONE')) return;

  let eventoRef = null;
  if (eventoIdUnivoco) {
    const snap = await eventiCol(tenantId).where('idUnivoco', '==', eventoIdUnivoco).limit(1).get();
    if (!snap.empty) eventoRef = snap.docs[0].ref;
  }
  if (!eventoRef && eventoCorrelato) {
    const snap = await eventiCol(tenantId).where('idEvento', '==', eventoCorrelato).limit(1).get();
    if (!snap.empty) eventoRef = snap.docs[0].ref;
  }
  if (!eventoRef) return;
  const evSnap = await eventoRef.get();
  if (!evSnap.exists || evSnap.data()?.stato === false) return;
  if (evSnap.data()?.operativoTerminato === true) return;
  await eventoRef.set(
    {
      operativoTerminato: true,
      operativoTerminatoIl: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Avanza lo stato leggendo la missione aggiornata (rispetta salti imposti dalla centrale).
 * @returns {{ ok: boolean, error?: string, precedente?: string, nuovo?: string, missione?: object, terminal?: boolean }}
 */
export async function advanceMissioneStato(tenantId, missionDocId, expectedMezzo) {
  const missione = await getMissioneById(tenantId, missionDocId);
  if (!missione) return { ok: false, error: 'Missione non trovata' };
  if (missione.mezzo !== expectedMezzo) {
    return { ok: false, error: 'Questa missione non è del tuo mezzo' };
  }
  if (missione.aperta === false || isStatoMissioneTerminale(missione.stato)) {
    return { ok: false, error: 'Missione già chiusa', missione, terminal: true };
  }

  const stati = await getStatiMissione(tenantId);
  const precedente = missione.stato ?? 'ALLERTARE';
  const nuovo = nextStatoMissione(precedente, stati);
  if (nuovo === precedente) {
    return { ok: false, error: 'Nessuno stato successivo disponibile', missione, terminal: true };
  }

  const fields = buildStatoChangeFields(missione, nuovo);
  await missioniCol(tenantId).doc(missionDocId).update(fields);

  const missioneAggiornata = { ...missione, ...fields, stato: nuovo };

  if (nuovo === 'ARRIVATO H') {
    await syncPazientiArrivatoHAdmin(tenantId, missioneAggiornata);
  }
  if (nuovo === 'RIENTRO' || nuovo === 'FINE MISSIONE') {
    await patchMezzoAdmin(tenantId, expectedMezzo, { statoMezzo: 'Disponibile' });
  }
  if (nuovo === 'ANNULLATA') {
    const motivo = missione.missioneEccezioneMotivo;
    if (motivo === 'AVARIA_SINISTRO') {
      await patchMezzoAdmin(tenantId, expectedMezzo, {
        statoMezzo: MEZZO_STATO_AVARIA_SINISTRO,
        operativo: false,
      });
    } else {
      await patchMezzoAdmin(tenantId, expectedMezzo, { statoMezzo: 'Disponibile' });
    }
  }

  await tryAutoCloseEventoAdmin(
    tenantId,
    missione.eventoIdUnivoco,
    missione.eventoCorrelato,
  );

  if (nuovo === 'DIRETTO H') {
    try {
      await syncPmappOnDirettoH(tenantId, missionDocId);
    } catch (e) {
      console.warn('[advanceMissioneStato pmapp]', e.message ?? e);
    }
  }

  return {
    ok: true,
    precedente,
    nuovo,
    missione: missioneAggiornata,
    terminal: isStatoMissioneTerminale(nuovo),
  };
}
