import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';
import { impostazioniDocRef } from './telegramFirestore.js';
import { buildStatoChangeFields } from './missionStoricoStati.js';
import {
  canEquipaggioAvanzareStatoDaTelegram,
  isStatoMissioneTerminale,
  nextStatoMissione,
} from './missionStati.js';
import { resolveMezzoSiglaForTelegram } from './mezzoResolve.js';
import {
  applyArrivatoHPatchAdminTransaction,
  applyDirettoHPatchAdminTransaction,
  initPmaSchedaIfMissingAdmin,
  pazienteEsclusoDaSyncMissioneAdmin,
} from './pazienteMissionPmaAdmin.js';
import { pazienteSuMissione } from './pazienteMissionMatch.js';

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

const MEZZO_STATO_AVARIA_SINISTRO = 'Non operativo (avaria/sinistro)';

function normalizeMezzoKey(sigla) {
  return String(sigla ?? '')
    .replace(/_/g, '')
    .toLowerCase();
}

function normalizeStatoPzPmaAdmin(stato) {
  const v = String(stato ?? '').trim();
  if (v === 'IN ARRIVO') return 'IN ARRIVO';
  if (v === 'IN ATTESA') return 'IN ATTESA';
  if (v === 'in carico') return 'in carico';
  if (v === 'DIMESSO') return 'DIMESSO';
  return null;
}

function pazientePmaApertoAdmin(p) {
  const stato = normalizeStatoPzPmaAdmin(p?.statoPzPma);
  return stato === 'IN ARRIVO' || stato === 'IN ATTESA' || stato === 'in carico';
}

function missioneBloccaMezzo(missione) {
  if (!missione || missione.aperta === false) return false;
  const s = missione.stato ?? '';
  if (s === 'FINE MISSIONE' || s === 'ANNULLATA') return false;
  if (s === 'RIENTRO' || s === 'ARRIVATO H') return false;
  return true;
}

async function mezzoHaAltreMissioniBloccantiAdmin(tenantId, mezzoSiglaRaw, excludeDocId) {
  const nk = normalizeMezzoKey(mezzoSiglaRaw);
  if (!nk) return false;
  const snap = await missioniCol(tenantId).get();
  return snap.docs.some((d) => {
    if (d.id === excludeDocId) return false;
    const m = d.data();
    if (m.aperta === false) return false;
    if (!m.mezzo || normalizeMezzoKey(m.mezzo) !== nk) return false;
    return missioneBloccaMezzo(m);
  });
}

async function syncStatoMezzoDopoMissioneAdmin(tenantId, mezzoSiglaRaw, excludeDocId, stato, motivoEccezione) {
  if (!mezzoSiglaRaw) return;
  if (await mezzoHaAltreMissioniBloccantiAdmin(tenantId, mezzoSiglaRaw, excludeDocId)) {
    return;
  }
  const mezzoDoc = await resolveMezzoSiglaForTelegram(tenantId, mezzoSiglaRaw);
  if (!mezzoDoc) return;
  if (stato === 'ANNULLATA' && motivoEccezione === 'AVARIA_SINISTRO') {
    await patchMezzoAdmin(tenantId, mezzoDoc, {
      statoMezzo: MEZZO_STATO_AVARIA_SINISTRO,
      operativo: false,
    });
    return;
  }
  await patchMezzoAdmin(tenantId, mezzoDoc, { statoMezzo: 'Disponibile' });
}

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
  const mezzoCanonico = await resolveMezzoSiglaForTelegram(tenantId, mezzo);
  const nk = normalizeMezzoKey(mezzoCanonico || mezzo);
  const snap = await missioniCol(tenantId).get();
  return snap.docs
    .map((d) => ({ _docId: d.id, ...d.data() }))
    .filter(
      (m) =>
        normalizeMezzoKey(m.mezzo) === nk &&
        m.aperta !== false &&
        !isStatoMissioneTerminale(m.stato),
    )
    .sort((a, b) => String(a.idMissione ?? '').localeCompare(String(b.idMissione ?? ''), 'it'));
}

async function patchMezzoAdmin(tenantId, sigla, fields) {
  if (!sigla || !fields || Object.keys(fields).length === 0) return;
  await mezziCol(tenantId).doc(sigla).set(fields, { merge: true });
}

async function findEventoForPazienteAdmin(tenantId, paziente) {
  if (paziente.eventoIdUnivoco) {
    const snap = await eventiCol(tenantId).where('idUnivoco', '==', paziente.eventoIdUnivoco).limit(1).get();
    if (!snap.empty) return snap.docs[0].data();
  }
  if (paziente.eventoCorrelato) {
    const snap = await eventiCol(tenantId).where('idEvento', '==', paziente.eventoCorrelato).limit(1).get();
    if (!snap.empty) return snap.docs[0].data();
  }
  return null;
}

async function queryTrasportoPerCampoAdmin(tenantId, field, value, missione) {
  if (!value) return [];
  try {
    const snap = await pazientiCol(tenantId)
      .where(field, '==', value)
      .where('esito', '==', 'Trasporta')
      .limit(64)
      .get();
    return snap.docs
      .map((d) => ({ _docId: d.id, ...d.data() }))
      .filter((p) => pazienteSuMissione(p, missione));
  } catch {
    return [];
  }
}

async function scanTrasportoEventoAdmin(tenantId, missione) {
  let q = pazientiCol(tenantId).where('esito', '==', 'Trasporta');
  if (missione.eventoIdUnivoco) {
    q = q.where('eventoIdUnivoco', '==', missione.eventoIdUnivoco);
  } else if (missione.eventoCorrelato) {
    q = q.where('eventoCorrelato', '==', missione.eventoCorrelato);
  } else {
    return [];
  }
  const pageSize = 200;
  const all = [];
  let last = null;
  for (;;) {
    let query = q.limit(pageSize);
    if (last) query = query.startAfter(last);
    const snap = await query.get();
    if (snap.empty) break;
    all.push(...snap.docs.map((d) => ({ _docId: d.id, ...d.data() })));
    last = snap.docs[snap.docs.length - 1];
    if (snap.size < pageSize) break;
  }
  return all.filter((p) => pazienteSuMissione(p, missione));
}

/** Come client: preferisce missioneIdUnivoco, poi idMissione, infine scan evento. */
async function fetchPazientiTrasportoForMissioneAdmin(tenantId, missione) {
  if (!missione || !tenantId) return [];

  const byUid = await queryTrasportoPerCampoAdmin(
    tenantId,
    'missioneIdUnivoco',
    String(missione.idUnivoco ?? '').trim(),
    missione,
  );
  if (byUid.length > 0) return byUid;

  const byIdMissione = await queryTrasportoPerCampoAdmin(
    tenantId,
    'idMissione',
    String(missione.idMissione ?? '').trim(),
    missione,
  );
  if (byIdMissione.length > 0) return byIdMissione;

  return scanTrasportoEventoAdmin(tenantId, missione);
}

async function findEventoForMissioneAdmin(tenantId, missione) {
  if (missione?.eventoIdUnivoco) {
    const snap = await eventiCol(tenantId)
      .where('idUnivoco', '==', missione.eventoIdUnivoco)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
  }
  if (missione?.eventoCorrelato) {
    const snap = await eventiCol(tenantId)
      .where('idEvento', '==', missione.eventoCorrelato)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].data();
  }
  return null;
}

async function syncPazientiArrivatoHAdmin(tenantId, missione) {
  if (!missione) return;
  const candidati = await fetchPazientiTrasportoForMissioneAdmin(tenantId, missione);
  const evento = await findEventoForMissioneAdmin(tenantId, missione);

  const db = getAdminDb();
  for (const p of candidati) {
    if (p.stato === 'ARRIVATO H') continue;
    await applyArrivatoHPatchAdminTransaction(db, tenantId, p._docId, evento);
  }
}

async function syncPazientiPmaOnDirettoHAdmin(tenantId, missione) {
  if (!missione) return;
  const candidati = await fetchPazientiTrasportoForMissioneAdmin(tenantId, missione);
  const db = getAdminDb();

  for (const p of candidati) {
    if (pazienteEsclusoDaSyncMissioneAdmin(p)) continue;
    if (!String(p.destinazionePmaId ?? '').trim()) continue;
    const evento = !p.pmaScheda ? await findEventoForPazienteAdmin(tenantId, p) : null;
    await applyDirettoHPatchAdminTransaction(db, tenantId, p._docId, evento, missione);
  }
}

function isMissioneTerminata(m) {
  return m.aperta === false || isStatoMissioneTerminale(m.stato);
}

function pazienteInElencoApertiAdmin(p) {
  if (!p) return false;
  const tipo = String(p.tipoPz ?? '')
    .trim()
    .toUpperCase();
  if (tipo === 'PMA' || tipo === 'CODICE MINORE') {
    return String(p.statoPzPma ?? '').trim().toUpperCase() !== 'DIMESSO';
  }
  if (p.aperta !== false && p.stato !== 'ARRIVATO H') return true;
  if (!String(p.destinazionePmaId ?? '').trim()) return false;
  return String(p.statoPzPma ?? '').trim().toUpperCase() !== 'DIMESSO';
}

/** Come client: PMA aperta dopo ARRIVATO H non blocca operativo terminato. */
function pazienteBloccaChiusuraOperativaEventoAdmin(p) {
  if (!pazienteInElencoApertiAdmin(p)) return false;
  const chiusoCentrale = p.aperta === false || p.stato === 'ARRIVATO H';
  const tipo = String(p.tipoPz ?? '')
    .trim()
    .toUpperCase();
  const haPma =
    tipo === 'PMA' ||
    tipo === 'CODICE MINORE' ||
    Boolean(String(p.destinazionePmaId ?? '').trim());
  const pmaAperto = pazientePmaApertoAdmin(p);
  if (chiusoCentrale && haPma && pmaAperto) return false;
  return true;
}

function missioneConsenteChiusuraEventoAdmin(m) {
  if (!m) return false;
  if (m.aperta === false) return true;
  const s = m.stato ?? '';
  return s === 'RIENTRO' || s === 'FINE MISSIONE' || s === 'ANNULLATA';
}

function shouldAutoCloseEventoAdmin(missioni, pazientiEvento) {
  if (!missioni?.length) return false;
  if ((pazientiEvento ?? []).some(pazienteBloccaChiusuraOperativaEventoAdmin)) return false;
  if (!missioni.every(missioneConsenteChiusuraEventoAdmin)) return false;
  return missioni.some((m) => m.stato === 'FINE MISSIONE' || m.stato === 'RIENTRO');
}

async function fetchPazientiForEventoAdmin(tenantId, eventoIdUnivoco, eventoCorrelato) {
  if (eventoIdUnivoco) {
    const snap = await pazientiCol(tenantId)
      .where('eventoIdUnivoco', '==', eventoIdUnivoco)
      .get();
    return snap.docs.map((d) => d.data());
  }
  if (eventoCorrelato) {
    const snap = await pazientiCol(tenantId)
      .where('eventoCorrelato', '==', eventoCorrelato)
      .get();
    return snap.docs.map((d) => d.data());
  }
  return [];
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

  const pazientiEvento = await fetchPazientiForEventoAdmin(
    tenantId,
    eventoIdUnivoco,
    eventoCorrelato,
  );
  if (!shouldAutoCloseEventoAdmin(missioni, pazientiEvento)) return;

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
  const evData = evSnap.exists ? evSnap.data() : null;
  if (!evData || evData.stato === false) return;
  if (evData.operativoTerminato === true) return;
  if (evData.operativoAutoCloseSospeso === true) return;
  if (evData.sempreAperto === true) return;
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
export async function advanceMissioneStato(tenantId, missionDocId, expectedMezzo, options = {}) {
  const fromTelegram = options.fromTelegram === true;
  const missione = await getMissioneById(tenantId, missionDocId);
  if (!missione) return { ok: false, error: 'Missione non trovata' };
  if (!normalizeMezzoKey(missione.mezzo) || normalizeMezzoKey(missione.mezzo) !== normalizeMezzoKey(expectedMezzo)) {
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
  if (fromTelegram && !canEquipaggioAvanzareStatoDaTelegram(nuovo)) {
    return {
      ok: false,
      error:
        nuovo === 'ANNULLATA'
          ? 'Annullamento missione solo da centrale operativa'
          : 'Chiusura missione solo con stato FINE MISSIONE',
      missione,
    };
  }

  const fields = buildStatoChangeFields(missione, nuovo);
  await missioniCol(tenantId).doc(missionDocId).update(fields);

  const missioneAggiornata = { ...missione, ...fields, stato: nuovo };

  if (nuovo === 'ARRIVATO H') {
    await syncPazientiArrivatoHAdmin(tenantId, missioneAggiornata);
  }
  if (nuovo === 'DIRETTO H') {
    await syncPazientiPmaOnDirettoHAdmin(tenantId, missioneAggiornata);
  }
  if (nuovo === 'RIENTRO' || nuovo === 'FINE MISSIONE' || nuovo === 'ANNULLATA') {
    await syncStatoMezzoDopoMissioneAdmin(
      tenantId,
      expectedMezzo,
      missionDocId,
      nuovo,
      missione.missioneEccezioneMotivo,
    );
  }

  await tryAutoCloseEventoAdmin(
    tenantId,
    missione.eventoIdUnivoco,
    missione.eventoCorrelato,
  );

  return {
    ok: true,
    precedente,
    nuovo,
    missione: missioneAggiornata,
    terminal: isStatoMissioneTerminale(nuovo),
  };
}
