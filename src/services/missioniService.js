import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { missioniPath, pazientiPath } from '../lib/firestorePaths';
import { newIdUnivoco } from '../lib/ids';
import { nextProgressiveId } from './idGenerator';
import { patchMezzo } from './mezziService';
import { tryAutoCloseEventoForMissione } from './eventoAutoCloseService';
import { DEFAULT_IMPOSTAZIONI, ESITO_TRASPORTA } from '../constants';
import { pickGravestColore, normalizeCodiceColore } from '../lib/codiciColore';
import { ESITO_MISSIONE_DEFAULT } from '../lib/missioneEsito';
import { MISSIONE_ECCEZIONE_MOTIVO, MEZZO_STATO_AVARIA_SINISTRO } from '../lib/missionEccezioni';
import { patchPaziente } from './pazientiService';
import { syncPazientiArrivatoH } from './pazientiService';
import { notifyPmappDirettoHFromCentrale } from './pmappIntegrationService';
import { notifyTelegramStatoFromCentrale } from './telegramService';

function formatEquipaggio(equipaggio) {
  if (!equipaggio) return '';
  const roles = [
    ['Autista', equipaggio.autista],
    ['Medico/CE', equipaggio.medico],
    ['Soccorritore 1', equipaggio.soccorritore1],
    ['Soccorritore 2', equipaggio.soccorritore2],
  ];
  return roles
    .map(([label, p]) => {
      if (!p?.nome && !p?.cognome) return null;
      const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
      const tel = p.telefono ? ` — ${p.telefono}` : '';
      return `${label}: ${nome}${tel}`;
    })
    .filter(Boolean)
    .join(' | ');
}

export async function createMissione(manifestationId, payload, existingMissioni, mezzo) {
  const idMissione = nextProgressiveId('M', existingMissioni, 'idMissione');
  const idUnivoco = newIdUnivoco();
  const autopresentato = !!payload.pazienteAutopresentato;
  const forzato = payload.statoInizialeForzato;
  const statiAmmessi = DEFAULT_IMPOSTAZIONI.statiMissione;
  const statoIniziale =
    forzato && statiAmmessi.includes(forzato)
      ? forzato
      : autopresentato
        ? 'IN POSTO'
        : 'ALLERTARE';
  const coloreEvento = normalizeCodiceColore(payload.coloreEvento ?? 'Bianco');
  const colRef = collection(db, ...missioniPath(manifestationId));
  const docRef = await addDoc(colRef, {
    manifestationId,
    idUnivoco,
    idMissione,
    eventoIdUnivoco: payload.eventoIdUnivoco,
    eventoCorrelato: payload.eventoCorrelato,
    mezzo: payload.mezzo,
    stato: statoIniziale,
    statoDa: serverTimestamp(),
    storicoStati: { [statoIniziale]: serverTimestamp() },
    pazienteAutopresentato: autopresentato,
    equipaggio: formatEquipaggio(mezzo?.equipaggio),
    aperta: true,
    apertura: serverTimestamp(),
    noteMissione: '',
    tratteMissione: [],
    codiceColoreMissione: coloreEvento,
    codiceColoreTrasporto: coloreEvento,
    esitoMissione: ESITO_MISSIONE_DEFAULT,
  });
  await patchMezzo(manifestationId, payload.mezzo, { statoMezzo: 'Non disponibile' });
  return { docId: docRef.id, idMissione, idUnivoco };
}

const COLORI_VALIDI = new Set(DEFAULT_IMPOSTAZIONI.coloriEvento);

async function findMissioneDocForPaziente(manifestationId, paziente) {
  const colRef = collection(db, ...missioniPath(manifestationId));
  if (paziente.missioneIdUnivoco) {
    const q = query(colRef, where('idUnivoco', '==', paziente.missioneIdUnivoco), limit(4));
    const snap = await getDocs(q);
    const hit = snap.docs.find((d) => d.data().aperta !== false) ?? snap.docs[0];
    if (hit) return { id: hit.id, data: hit.data() };
  }
  if (paziente.idMissione && paziente.mezzo) {
    const q = query(colRef, where('idMissione', '==', paziente.idMissione), limit(24));
    const snap = await getDocs(q);
    const open = snap.docs.find((d) => {
      const x = d.data();
      return x.mezzo === paziente.mezzo && x.aperta !== false;
    });
    if (open) return { id: open.id, data: open.data() };
  }
  return null;
}

function pazienteMatchesMissione(p, missione) {
  const sameEvento =
    (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
    p.eventoCorrelato === missione.eventoCorrelato;
  return sameEvento && p.mezzo === missione.mezzo && p.esito === ESITO_TRASPORTA;
}

/** Ricalcola codice colore trasporto dai pazienti in trasporto sul mezzo (se non impostato manualmente). */
export async function refreshMissioneCodiceColoreTrasporto(manifestationId, missionDocId, missione) {
  if (!missionDocId || !missione || missione.codiceColoreTrasportoManuale === true) return;
  const pazientiSnap = await getDocs(collection(db, ...pazientiPath(manifestationId)));
  const colori = [];
  for (const d of pazientiSnap.docs) {
    const p = d.data();
    if (!pazienteMatchesMissione(p, missione)) continue;
    const c = p.codiceColoreSanitario ?? p.codiceColore;
    if (c && COLORI_VALIDI.has(c)) colori.push(c);
  }
  const next = colori.length
    ? pickGravestColore(colori)
    : normalizeCodiceColore(missione.codiceColoreMissione ?? missione.codiceColore);
  await updateDoc(doc(db, ...missioniPath(manifestationId), missionDocId), {
    codiceColoreTrasporto: next,
  });
}

/**
 * Allinea colore sanitario paziente e codice trasporto missione (valutazione MSB/MSA).
 */
export async function patchMissioneCodiceColoreFromPaziente(manifestationId, paziente, codiceColore) {
  if (!manifestationId || !paziente || codiceColore == null || codiceColore === '') return;
  if (!COLORI_VALIDI.has(codiceColore)) return;

  if (paziente._docId) {
    await patchPaziente(manifestationId, paziente._docId, {
      codiceColoreSanitario: codiceColore,
    });
  }

  const hit = await findMissioneDocForPaziente(manifestationId, paziente);
  if (!hit) return;
  await refreshMissioneCodiceColoreTrasporto(manifestationId, hit.id, hit.data);
}

export async function patchMissione(manifestationId, docId, fields, mezzoSigla) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...missioniPath(manifestationId), docId);
  const payload = { ...fields };
  if (fields.stato != null) {
    payload.statoDa = serverTimestamp();
  }
  await updateDoc(docRef, payload);
  if (fields.stato === 'ARRIVATO H') {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await syncPazientiArrivatoH(manifestationId, { _docId: snap.id, ...snap.data() });
    }
  }
  if (fields.stato === 'RIENTRO' && mezzoSigla) {
    await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
  }
  if (fields.stato === 'FINE MISSIONE' && mezzoSigla) {
    await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
  }
  if (fields.stato === 'ANNULLATA' && mezzoSigla) {
    const motivo = fields.missioneEccezioneMotivo;
    if (motivo === MISSIONE_ECCEZIONE_MOTIVO.AVARIA_SINISTRO) {
      await patchMezzo(manifestationId, mezzoSigla, {
        statoMezzo: MEZZO_STATO_AVARIA_SINISTRO,
        operativo: false,
      });
    } else {
      await patchMezzo(manifestationId, mezzoSigla, { statoMezzo: 'Disponibile' });
    }
  }
  if (fields.stato != null || fields.aperta != null) {
    await tryAutoCloseEventoForMissione(manifestationId, docId);
  }
  if (fields.stato != null) {
    notifyTelegramStatoFromCentrale(manifestationId, docId);
    if (fields.stato === 'DIRETTO H') {
      notifyPmappDirettoHFromCentrale(manifestationId, docId);
    }
  }
}
