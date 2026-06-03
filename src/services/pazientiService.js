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
import { normalizeMsaDetails } from '../lib/msaValutazione';
import { newValutazioneSoccorsoItem, payloadValutazioneRow } from '../lib/valutazioniSoccorsoPayload';
import { buildValutazioneGranularUpdates } from '../lib/valutazioneSoccorsoGranularUpdate';
import { defaultsForPatientCreate } from '../lib/pazienteDefaults';
import { buildCodiceMinoreTrasportoNome } from '../lib/codiceMinoreTrasportoNome';
import { patchPazienteArrivatoHConPma, statoPzPmaInArrivoIfAllowed } from './pazientePmaMissionSync';
import { omitUndefinedFields } from '../lib/firestorePatch';
import { assertPazientePatchGranular } from '../lib/granularFirestorePatch';
import { initPmaSchedaIfMissing } from '../pma/lib/pazientePmaPatch';
import {
  fetchEventoForMissione,
  fetchPazientiTrasportoForMissione,
} from '../lib/pazientiTrasportoQuery';
import {
  missioniPath,
  pazientiPath,
  pazienteValutazioniSoccorsoPathSegments,
} from '../lib/firestorePaths';
import { TIPO_PZ } from '../lib/pmaModule';
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
  let initSeed = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const p = { _docId: snap.id, ...snap.data() };
    if (p.esito !== ESITO_TRASPORTA || p.stato === 'ARRIVATO H') return;

    const result = patchPazienteArrivatoHConPma(p, evento);
    if (!result?.patch) return;

    const payload = omitUndefinedFields(result.patch);
    if (Object.keys(payload).length === 0) return;
    assertPazientePatchGranular(payload);
    transaction.update(ref, payload);
    if (result.initPmaScheda) initSeed = result.pmaSchedaSeed;
  });

  if (initSeed !== null) {
    await initPmaSchedaIfMissing(manifestationId, patientDocId, initSeed);
  }
}

/** Allinea stato PMA «IN ARRIVO» solo se consentito (lettura fresca transazionale). */
export async function transitionPazientePmaInArrivoIfAllowed(manifestationId, patientDocId) {
  if (!patientDocId) return false;
  const ref = pazienteDocRef(manifestationId, patientDocId);
  let updated = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) return;
    const p = { _docId: snap.id, ...snap.data() };
    const nextStato = statoPzPmaInArrivoIfAllowed(p);
    if (!nextStato) return;
    transaction.update(ref, {
      tipoPz: p.tipoPz ?? TIPO_PZ.CENTRALE,
      pmaId: p.pmaId ?? p.destinazionePmaId ?? '',
      statoPzPma: nextStato,
    });
    updated = true;
  });

  return updated;
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
  if (d.percorsoCodiceMinore && !String(d.nome ?? '').trim()) {
    d.nome = buildCodiceMinoreTrasportoNome({ mezzo: d.mezzo, idPaziente });
  }

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

  let pmaFollowUpError = null;
  if (String(d.destinazionePmaId ?? '').trim()) {
    try {
      if (d.percorsoCodiceMinore === true) {
        const { ensureCodiceMinoreOnDestinazione } = await import('./pazientePmaMissionSync');
        await ensureCodiceMinoreOnDestinazione(
          manifestationId,
          patientRef.id,
          { ...payload, ...d, idPaziente, percorsoCodiceMinore: true },
          null,
        );
      } else {
        await initPmaSchedaIfMissing(manifestationId, patientRef.id, payload.pmaSchedaSeed ?? null);
      }
    } catch (err) {
      pmaFollowUpError = err instanceof Error ? err.message : String(err);
    }
  }

  return { docId: patientRef.id, idPaziente, idUnivoco, pmaFollowUpError };
}

export async function patchPaziente(manifestationId, docId, fields) {
  if (!docId || !fields || Object.keys(fields).length === 0) return;
  assertPazientePatchGranular(fields);
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

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);
    if (!snap.exists()) {
      transaction.set(ref, payloadValutazioneRow({ id: valutazioneId, ...payload }));
      return;
    }

    const current = snap.data();
    const updates = buildValutazioneGranularUpdates(current, payload);
    if (Object.keys(updates).length > 0) {
      transaction.update(ref, updates);
    }
  });
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

/** Quando la missione passa ad ARRIVATO H, aggiorna i pazienti in trasporto su quella missione. */
export async function syncPazientiArrivatoH(manifestationId, missione) {
  if (!missione) return;

  const [candidati, evento] = await Promise.all([
    fetchPazientiTrasportoForMissione(manifestationId, missione),
    fetchEventoForMissione(manifestationId, missione),
  ]);

  for (const p of candidati) {
    await transitionPazienteArrivatoHTransaction(manifestationId, p._docId, evento);
  }
}

export async function loadMissione(manifestationId, missionDocId) {
  const docRef = doc(db, ...missioniPath(manifestationId), missionDocId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { _docId: snap.id, ...snap.data() };
}
