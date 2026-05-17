import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  deleteField,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { ESITO_TRASPORTA } from '../constants';
import { normalizeMsbDetails } from '../lib/msbValutazione';
import { applyMissioneArrivatoH } from '../lib/pazienteRules';
import { missioniPath, pazientiPath, pazienteValutazioniSoccorsoPathSegments } from '../lib/firestorePaths';
import { newIdUnivoco } from '../lib/ids';
import { nextProgressiveId } from './idGenerator';

export function pazienteDocRef(manifestationId, docId) {
  return doc(db, ...pazientiPath(manifestationId), docId);
}

export function valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, valutazioneDocId) {
  return doc(
    db,
    ...pazienteValutazioniSoccorsoPathSegments(manifestationId, pazienteDocId),
    valutazioneDocId,
  );
}

async function flushBatchDeletes(batchDeletes) {
  if (batchDeletes.length === 0) return;
  let batch = writeBatch(db);
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    ops = 0;
  };
  for (const ref of batchDeletes) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) await commit();
  }
  await commit();
}

export async function deletePazienteCascade(manifestationId, patientFirestoreDocId) {
  if (!patientFirestoreDocId) return;
  const parentRef = pazienteDocRef(manifestationId, patientFirestoreDocId);
  const valCol = collection(
    db,
    ...pazienteValutazioniSoccorsoPathSegments(manifestationId, patientFirestoreDocId),
  );
  const snaps = await getDocs(valCol);
  const dels = snaps.docs.map((d) => d.ref);
  await flushBatchDeletes(dels);
  await deleteDoc(parentRef);
}

/** Transazione: un solo cliente imposta stato ARRIVATO H e timestamp. */
export async function transitionPazienteArrivatoHTransaction(manifestationId, patientDocId) {
  if (!patientDocId) return;
  const ref = pazienteDocRef(manifestationId, patientDocId);
  await runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists()) return;
    const d = snap.data();
    if (d.esito !== ESITO_TRASPORTA || d.stato === 'ARRIVATO H') return;
    t.update(ref, {
      stato: 'ARRIVATO H',
      arrivatoHAt: Timestamp.now(),
      aperta: false,
    });
  });
}

function payloadValutazioneRow(v) {
  const base = {
    tipo: v.tipo === 'MSA' ? 'MSA' : 'MSB',
    testo: v.testo ?? '',
    creatoIl: v.creatoIl ?? Timestamp.now(),
  };
  if (base.tipo === 'MSB') {
    base.msbDetails = normalizeMsbDetails(v.msbDetails);
    return base;
  }
  return { ...base, msbDetails: null, mezzo: v.mezzo ?? '' };
}

export async function createPaziente(manifestationId, payload, existingPazienti) {
  const idPaziente = nextProgressiveId('P', existingPazienti, 'idPaziente');
  const idUnivoco = newIdUnivoco();
  const colRef = collection(db, ...pazientiPath(manifestationId));
  const patientRef = doc(colRef);

  const vals = Array.isArray(payload.valutazioniSoccorso) ? payload.valutazioniSoccorso : [];

  const batch = writeBatch(db);

  batch.set(patientRef, {
    manifestationId,
    idUnivoco,
    idPaziente,
    eventoIdUnivoco: payload.eventoIdUnivoco,
    eventoCorrelato: payload.eventoCorrelato,
    aperta: payload.aperta !== false,
    apertura: payload.apertura ?? serverTimestamp(),
    esito: payload.esito ?? '',
    esitoAltro: payload.esitoAltro ?? '',
    ospedaleDestinazione: payload.ospedaleDestinazione ?? '',
    stato: payload.stato ?? 'ATTESA',
    mezzo: payload.mezzo ?? '',
    idMissione: payload.idMissione ?? '',
    missioneIdUnivoco: payload.missioneIdUnivoco ?? '',
    arrivatoHAt: payload.arrivatoHAt ?? null,
    pettorale:
      payload.pettorale != null && payload.pettorale !== ''
        ? Number(payload.pettorale)
        : null,
    telefono: payload.telefono ?? '',
    dataNascita: payload.dataNascita ?? '',
    nome: payload.nome ?? '',
    cognome: payload.cognome ?? '',
    eta: payload.eta ?? null,
    sesso: payload.sesso ?? '',
    notePaziente: payload.notePaziente ?? '',
  });

  for (const v of vals) {
    const id = v.id;
    if (!id) continue;
    const vref = valutazioneSoccorsoDocRef(manifestationId, patientRef.id, id);
    batch.set(vref, payloadValutazioneRow(v));
  }

  await batch.commit();
  return { docId: patientRef.id, idPaziente, idUnivoco };
}

export async function patchPaziente(manifestationId, docId, fields) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await updateDoc(docRef, fields);
}

export async function setValutazioneSoccorsoDoc(manifestationId, pazienteDocId, item) {
  if (!item?.id || !pazienteDocId) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, item.id);
  await setDoc(ref, payloadValutazioneRow(item));
}

export async function updateValutazioneSoccorsoDoc(manifestationId, pazienteDocId, valutazioneId, fields) {
  if (!pazienteDocId || !valutazioneId || !fields || Object.keys(fields).length === 0) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, valutazioneId);
  await updateDoc(ref, fields);
}

export async function deleteValutazioneSoccorsoDoc(manifestationId, pazienteDocId, valutazioneId) {
  if (!pazienteDocId || !valutazioneId) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, valutazioneId);
  await deleteDoc(ref);
}

/** Migra array legacy `valutazioniSoccorso` nel documento paziente → sottocollezione (una tantum). */
export async function migrateLegacyValutazioniIfNeeded(
  manifestationId,
  pazienteDocId,
  legacyRows,
) {
  if (!pazienteDocId || !Array.isArray(legacyRows) || legacyRows.length === 0) return;

  const valCol = collection(
    db,
    ...pazienteValutazioniSoccorsoPathSegments(manifestationId, pazienteDocId),
  );
  const existing = await getDocs(valCol);
  if (!existing.empty) return;

  const pref = pazienteDocRef(manifestationId, pazienteDocId);

  /* Prima scriviamo tutta la sotto-collezione, poi rimuoviamo l’array sul parent:
   * così un fallimento di rete/commit non lascia il paziente senza né array né valutazioni. */
  const MAX = 450;
  let batch = writeBatch(db);
  let ops = 0;
  for (let i = 0; i < legacyRows.length; i += 1) {
    const v = legacyRows[i];
    const id =
      v.id ||
      (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `legacy-${i}`);
    const vref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, id);
    batch.set(vref, payloadValutazioneRow({ ...v, id }));
    ops += 1;
    if (ops >= MAX) {
      await batch.commit();
      batch = writeBatch(db);
      ops = 0;
    }
  }
  if (ops > 0) await batch.commit();

  await updateDoc(pref, { valutazioniSoccorso: deleteField() });
}

/** Quando la missione passa ad ARRIVATO H, aggiorna **tutti** i pazienti in trasporto su quel mezzo (carico multiplo). */
export async function syncPazientiArrivatoH(manifestationId, missione) {
  if (!missione?.mezzo) return;
  const colRef = collection(db, ...pazientiPath(manifestationId));
  const snap = await getDocs(colRef);
  const tasks = [];

  snap.forEach((docSnap) => {
    const p = { _docId: docSnap.id, ...docSnap.data() };
    const sameEvento =
      (missione.eventoIdUnivoco && p.eventoIdUnivoco === missione.eventoIdUnivoco) ||
      p.eventoCorrelato === missione.eventoCorrelato;
    /* Stesso mezzo + evento: ogni passeggero in «Trasporta» viene portato ad ARRIVATO H. */
    if (!sameEvento || p.mezzo !== missione.mezzo || p.esito !== ESITO_TRASPORTA) return;
    const patch = applyMissioneArrivatoH(p);
    if (patch) tasks.push(patchPaziente(manifestationId, docSnap.id, patch));
  });

  await Promise.all(tasks);
}

export async function loadMissione(manifestationId, missionDocId) {
  const docRef = doc(db, ...missioniPath(manifestationId), missionDocId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}
