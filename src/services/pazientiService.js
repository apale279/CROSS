import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
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
import { normalizeMsaDetails } from '../lib/msaValutazione';
import { newValutazioneSoccorsoItem, payloadValutazioneRow } from '../lib/valutazioniSoccorsoPayload';
import { defaultsForPatientCreate } from '../lib/pazienteDefaults';
import { patchPazienteArrivatoHConPma } from './pazientePmaMissionSync';
import { omitUndefinedFields } from '../lib/firestorePatch';
import { initPmaSchedaIfMissing } from '../pma/lib/pazientePmaPatch';
import {
  fetchEventoForMissione,
  fetchPazientiTrasportoForMissione,
  pazienteSameEventoAsMissione,
} from '../lib/pazientiTrasportoQuery';
import {
  missioniPath,
  pazientiPath,
  pazienteValutazioniSoccorsoPathSegments,
} from '../lib/firestorePaths';
import { newIdUnivoco } from '../lib/ids';
import { allocateProgressiveId } from './progressiveIdService';

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

/** Transizione singolo paziente ad ARRIVATO H (con sync PMA se destinazione tenda). */
export async function transitionPazienteArrivatoHTransaction(
  manifestationId,
  patientDocId,
  evento = null,
) {
  if (!patientDocId) return;
  const ref = pazienteDocRef(manifestationId, patientDocId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const p = { _docId: snap.id, ...snap.data() };
  if (p.esito !== ESITO_TRASPORTA || p.stato === 'ARRIVATO H') return;

  const result = patchPazienteArrivatoHConPma(p, evento);
  if (!result?.patch) return;

  await patchPaziente(manifestationId, patientDocId, result.patch);
  if (result.initPmaScheda) {
    await initPmaSchedaIfMissing(manifestationId, patientDocId, result.pmaSchedaSeed);
  }
}

export { payloadValutazioneRow, newValutazioneSoccorsoItem } from '../lib/valutazioniSoccorsoPayload';

export async function createPaziente(manifestationId, payload, existingPazienti) {
  const idPaziente = await allocateProgressiveId(
    manifestationId,
    'P',
    'pazienti',
    existingPazienti,
    'idPaziente',
  );
  const idUnivoco = newIdUnivoco();
  const colRef = collection(db, ...pazientiPath(manifestationId));
  const patientRef = doc(colRef);

  const vals = Array.isArray(payload.valutazioniSoccorso) ? payload.valutazioniSoccorso : [];
  const d = defaultsForPatientCreate(payload);

  const batch = writeBatch(db);

  batch.set(patientRef, {
    manifestationId,
    idUnivoco,
    idPaziente,
    eventoIdUnivoco: payload.eventoIdUnivoco ?? '',
    eventoCorrelato: payload.eventoCorrelato ?? '',
    apertura: payload.apertura ?? serverTimestamp(),
    ...d,
  });

  for (const v of vals) {
    const id = v.id;
    if (!id) continue;
    const vref = valutazioneSoccorsoDocRef(manifestationId, patientRef.id, id);
    batch.set(vref, payloadValutazioneRow(v));
  }

  await batch.commit();

  if (String(d.destinazionePmaId ?? '').trim()) {
    await initPmaSchedaIfMissing(manifestationId, patientRef.id, payload.pmaSchedaSeed ?? null);
  }

  return { docId: patientRef.id, idPaziente, idUnivoco };
}

export async function patchPaziente(manifestationId, docId, fields) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  const payload = omitUndefinedFields(fields);
  if (Object.keys(payload).length === 0) return;
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await updateDoc(docRef, payload);
}

export async function setValutazioneSoccorsoDoc(manifestationId, pazienteDocId, item) {
  const id = item?.id;
  if (!id || !pazienteDocId) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, id);
  const row = payloadValutazioneRow({ ...item, id });
  await setDoc(ref, row);
}

/** Salva l’intero snapshot MSB/MSA (utile se l’operatore non modifica i valori precompilati). */
export async function persistValutazioneSoccorsoSnapshot(manifestationId, pazienteDocId, item) {
  if (!item?.id || !pazienteDocId) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, item.id);
  await setDoc(ref, payloadValutazioneRow(item), { merge: true });
}

export async function updateValutazioneSoccorsoDoc(manifestationId, pazienteDocId, valutazioneId, fields) {
  const payload = omitUndefinedFields(fields);
  if (!pazienteDocId || !valutazioneId || Object.keys(payload).length === 0) return;
  const ref = valutazioneSoccorsoDocRef(manifestationId, pazienteDocId, valutazioneId);
  await updateDoc(ref, payload);
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

  const [candidati, evento] = await Promise.all([
    fetchPazientiTrasportoForMissione(manifestationId, missione),
    fetchEventoForMissione(manifestationId, missione),
  ]);

  for (const p of candidati) {
    if (!pazienteSameEventoAsMissione(p, missione)) continue;
    const result = patchPazienteArrivatoHConPma(p, evento);
    if (!result?.patch) continue;

    await patchPaziente(manifestationId, p._docId, result.patch);
    if (result.initPmaScheda) {
      await initPmaSchedaIfMissing(manifestationId, p._docId, result.pmaSchedaSeed);
    }
  }
}

export async function loadMissione(manifestationId, missionDocId) {
  const docRef = doc(db, ...missioniPath(manifestationId), missionDocId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}
