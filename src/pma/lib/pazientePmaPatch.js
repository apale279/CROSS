import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../cross/firebase';
import { pazientiPath } from '../../lib/firestorePaths';
import { omitUndefinedFields } from '../../lib/firestorePatch';
import { normalizePazientePatchInput, splitPazientePatch } from '../adapters/crossPazienteAdapter';
import { EMPTY_PMA_SCHEDA } from './pmaSchedaDefaults';
import { isEoColumnMergePatchPayload } from './eoQuickSelection';
import { assertPmaFieldLocksWritable } from '../services/pmaFieldPresenceService';
import { pmaFieldLocksRef } from './pmaFieldPresencePaths';
import { mergeSchedaArrayById } from './pmaSchedaArrayMerge';
import {
  buildGranularUpdatesFromSnapshot,
  isFirestoreFieldValue,
  lockKeysFromPlan,
  planHasSchedaWrites,
} from './pmaPatchSnapshot';

export { mergeSchedaArrayById };

const PMA_SCHEDA_PREFIX = 'pmaScheda.';

/** Campi array in `pmaScheda`: merge transazionale per non sovrascrivere altri operatori. */
const PMA_SCHEDA_ARRAY_FIELDS = new Set([
  'parametri_vitali',
  'farmaci',
  'rivalutazioni',
  'lesioni',
  'prestazioni_sel',
  'EO_GENERALE',
  'EO_NEUROLOGICO',
  'EO_CUTE',
  'EO_TORACE',
  'EO_ADDOME',
  'EO_CAPO_COLLO',
]);

/** Imposta default EO solo se la colonna è ancora vuota sul server (multi-operatore). */
export async function ensurePmaSchedaEoDefaultsIfEmpty(manifestationId, docId, entries) {
  if (!manifestationId || !docId || !entries?.length) return;

  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists()) return;
    const scheda = snap.data().pmaScheda ?? {};
    const updates = {};

    for (const { field, defLabel } of entries) {
      const label = String(defLabel ?? '').trim();
      if (!label) continue;
      const raw = scheda[field];
      const current = Array.isArray(raw) ? raw.map((x) => String(x).trim()).filter(Boolean) : [];
      if (current.length > 0) continue;
      updates[`${PMA_SCHEDA_PREFIX}${field}`] = [label];
    }

    if (Object.keys(updates).length > 0) {
      transaction.update(docRef, updates);
    }
  });
}

/** Inizializza `pmaScheda` solo se assente (path puntati, senza sovrascrivere). */
export async function initPmaSchedaIfMissing(manifestationId, docId, seed = null) {
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  const merged = { ...EMPTY_PMA_SCHEDA, ...(seed && typeof seed === 'object' ? seed : {}) };
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists() || snap.data().pmaScheda) return;
    const initFields = {};
    for (const [key, value] of Object.entries(merged)) {
      initFields[`${PMA_SCHEDA_PREFIX}${key}`] = value;
    }
    transaction.update(docRef, initFields);
  });
}

/**
 * Converte patch UI in updateDoc con path puntati (mai `pmaScheda` intero).
 */
export function flattenPazientePatchForFirestore(patch) {
  const split = splitPazientePatch(patch);
  const fields = {};

  for (const [key, value] of Object.entries(split)) {
    if (key === 'pmaScheda') continue;
    fields[key] = value;
  }

  const scheda = split.pmaScheda;
  if (scheda && typeof scheda === 'object') {
    for (const [key, value] of Object.entries(scheda)) {
      fields[`${PMA_SCHEDA_PREFIX}${key}`] = value;
    }
  }

  return fields;
}

function buildPatchPlan(flatFields) {
  const plan = {
    direct: {},
    eoMerges: [],
    arrayMerges: [],
  };

  for (const [path, value] of Object.entries(flatFields)) {
    if (!path.startsWith(PMA_SCHEDA_PREFIX)) {
      plan.direct[path] = value;
      continue;
    }
    const field = path.slice(PMA_SCHEDA_PREFIX.length);
    if (isEoColumnMergePatchPayload(value)) {
      plan.eoMerges.push({ field, payload: value });
    } else if (PMA_SCHEDA_ARRAY_FIELDS.has(field) && !isFirestoreFieldValue(value)) {
      plan.arrayMerges.push({ field, value });
    } else {
      plan.direct[path] = value;
    }
  }

  return plan;
}

function lockRef(manifestationId, pazienteDocId) {
  return doc(db, ...pmaFieldLocksRef(manifestationId, pazienteDocId));
}

/**
 * Una transazione: snapshot lock + paziente, verifica lock, merge array/EO, update solo campi cambiati.
 */
async function commitPatchPlanWithSnapshot(manifestationId, docId, plan, operatorUid) {
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  const lockKeys = lockKeysFromPlan(plan);
  const checkLocks = Boolean(operatorUid && lockKeys.length > 0);
  const locksDocRef = checkLocks ? lockRef(manifestationId, docId) : null;

  await runTransaction(db, async (transaction) => {
    const pazSnap = await transaction.get(docRef);
    if (!pazSnap.exists()) {
      throw new Error('Paziente non trovato.');
    }

    let lockFields = {};
    if (checkLocks && locksDocRef) {
      const lockSnap = await transaction.get(locksDocRef);
      lockFields = lockSnap.exists() ? lockSnap.data()?.fields ?? {} : {};
      assertPmaFieldLocksWritable(lockFields, lockKeys, operatorUid);
    }

    const updates = buildGranularUpdatesFromSnapshot(pazSnap.data(), plan);
    if (Object.keys(updates).length === 0) return;

    transaction.update(docRef, updates);
  });
}

/**
 * Aggiornamento granulare: snapshot transazionale, lock su campi in modifica, solo path modificati.
 * @param {{ operatorUid?: string }} [options] — operatore PMA: blocca scrittura se altri tengono il lock.
 */
export async function patchPazientePmaGranular(manifestationId, docId, patch, options = {}) {
  if (!manifestationId || !docId || !patch) return;

  const safePatch = normalizePazientePatchInput(patch);
  if (safePatch.pmaScheda && typeof safePatch.pmaScheda === 'object') {
    throw new Error('Aggiornamento pmaScheda intero non consentito: usare campi singoli.');
  }

  const fields = flattenPazientePatchForFirestore(safePatch);
  if (Object.prototype.hasOwnProperty.call(fields, 'pmaScheda')) {
    throw new Error('Aggiornamento documento PMA non granulare bloccato.');
  }

  const plan = buildPatchPlan(fields);
  const operatorUid = options.operatorUid ?? null;
  const hasScheda = planHasSchedaWrites(plan);
  const hasTopLevel = Object.keys(plan.direct).some((p) => !p.startsWith(PMA_SCHEDA_PREFIX));

  if (hasScheda || plan.eoMerges.length > 0 || plan.arrayMerges.length > 0 || operatorUid) {
    await commitPatchPlanWithSnapshot(manifestationId, docId, plan, operatorUid);
    return;
  }

  if (hasTopLevel) {
    const docRef = doc(db, ...pazientiPath(manifestationId), docId);
    const payload = omitUndefinedFields(plan.direct);
    if (Object.keys(payload).length > 0) {
      await updateDoc(docRef, payload);
    }
  }
}
