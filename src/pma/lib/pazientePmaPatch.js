import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../cross/firebase';
import { pazientiPath } from '../../lib/firestorePaths';
import { normalizePazientePatchInput, splitPazientePatch } from '../adapters/crossPazienteAdapter';
import { EMPTY_PMA_SCHEDA } from './pmaSchedaDefaults';
import { isEoColumnMergePatchPayload } from './eoQuickSelection';
import { mergeSchedaArrayById } from './pmaSchedaArrayMerge';
import {
  buildGranularUpdatesFromSnapshot,
  isFirestoreFieldValue,
  valuesEqual,
} from './pmaPatchSnapshot';
import { assertDimissionePatchAllowed } from './dimissionePatchGuard';

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

function extractPmaArrayRemoves(patch) {
  const raw = patch?._pmaArrayRemove;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [field, ids] of Object.entries(raw)) {
    if (!Array.isArray(ids) || !ids.length) continue;
    out[field] = ids;
  }
  return out;
}

function buildPatchPlan(flatFields, arrayRemoves = {}) {
  const plan = {
    direct: {},
    eoMerges: [],
    arrayMerges: [],
  };
  const arrayMergeFields = new Set();

  for (const [path, value] of Object.entries(flatFields)) {
    if (!path.startsWith(PMA_SCHEDA_PREFIX)) {
      plan.direct[path] = value;
      continue;
    }
    const field = path.slice(PMA_SCHEDA_PREFIX.length);
    if (isEoColumnMergePatchPayload(value)) {
      plan.eoMerges.push({ field, payload: value });
    } else if (PMA_SCHEDA_ARRAY_FIELDS.has(field) && !isFirestoreFieldValue(value)) {
      plan.arrayMerges.push({
        field,
        value,
        removeIds: arrayRemoves[field] ?? [],
      });
      arrayMergeFields.add(field);
    } else {
      plan.direct[path] = value;
    }
  }

  /** Rimozione esplicita anche senza array client (evita invio snapshot stale). */
  for (const [field, removeIds] of Object.entries(arrayRemoves)) {
    if (!Array.isArray(removeIds) || removeIds.length === 0) continue;
    if (!PMA_SCHEDA_ARRAY_FIELDS.has(field) || arrayMergeFields.has(field)) continue;
    plan.arrayMerges.push({ field, value: [], removeIds });
  }

  return plan;
}

/**
 * Una transazione: snapshot paziente, merge array/EO, update solo campi cambiati.
 * Lock presenza: solo avviso UI, mai blocco scrittura (cartella multi-operatore).
 */
async function commitPatchPlanWithSnapshot(manifestationId, docId, plan) {
  const docRef = doc(db, ...pazientiPath(manifestationId), docId);

  await runTransaction(db, async (transaction) => {
    const pazSnap = await transaction.get(docRef);
    if (!pazSnap.exists()) {
      throw new Error('Paziente non trovato.');
    }

    assertDimissionePatchAllowed(pazSnap.data(), plan);

    const updates = buildGranularUpdatesFromSnapshot(pazSnap.data(), plan);
    if (Object.keys(updates).length === 0) {
      const attemptedAppend = (plan.arrayMerges ?? []).some(
        (m) => Array.isArray(m.value) && m.value.length > 0 && !(m.removeIds?.length > 0),
      );
      if (attemptedAppend) {
        throw new Error(
          'Salvataggio non applicato (dati già presenti sul server). Aggiorna la pagina e riprova.',
        );
      }
      return;
    }

    transaction.update(docRef, updates);
  });
}

/**
 * Aggiunge una riga a un array `pmaScheda` (append transazionale, multi-operatore).
 */
export async function appendPmaSchedaArrayRow(manifestationId, docId, field, row) {
  if (!manifestationId || !docId || !row) return;
  if (!PMA_SCHEDA_ARRAY_FIELDS.has(field)) {
    throw new Error(`Campo array non supportato: ${field}`);
  }
  const rowId = String(row?.id ?? '').trim();
  if (!rowId) throw new Error('Riga senza id.');

  const docRef = doc(db, ...pazientiPath(manifestationId), docId);
  await runTransaction(db, async (transaction) => {
    const pazSnap = await transaction.get(docRef);
    if (!pazSnap.exists()) throw new Error('Paziente non trovato.');
    const scheda = pazSnap.data().pmaScheda ?? {};
    const server = scheda[field];
    const merged = mergeSchedaArrayById(server, [row]);
    const prev = Array.isArray(server) ? server : [];
    if (valuesEqual(prev, merged)) {
      throw new Error(
        'Impossibile aggiungere la riga: dati già allineati sul server. Aggiorna la pagina.',
      );
    }
    transaction.update(docRef, { [`${PMA_SCHEDA_PREFIX}${field}`]: merged });
  });
}

/**
 * Aggiornamento granulare: snapshot transazionale, lock su campi in modifica, solo path modificati.
 * @param {{ operatorUid?: string }} [options] — operatore PMA: blocca scrittura se altri tengono il lock.
 */
export async function patchPazientePmaGranular(manifestationId, docId, patch, options = {}) {
  if (!manifestationId || !docId || !patch) return;

  const arrayRemoves = extractPmaArrayRemoves(patch);
  const patchBody = { ...patch };
  delete patchBody._pmaArrayRemove;

  const safePatch = normalizePazientePatchInput(patchBody);
  if (safePatch.pmaScheda && typeof safePatch.pmaScheda === 'object') {
    throw new Error('Aggiornamento pmaScheda intero non consentito: usare campi singoli.');
  }

  const fields = flattenPazientePatchForFirestore(safePatch);
  if (Object.prototype.hasOwnProperty.call(fields, 'pmaScheda')) {
    throw new Error('Aggiornamento documento PMA non granulare bloccato.');
  }

  const plan = buildPatchPlan(fields, arrayRemoves);
  const hasAnyWrite =
    Object.keys(plan.direct).length > 0 ||
    plan.eoMerges.length > 0 ||
    plan.arrayMerges.length > 0;

  if (!hasAnyWrite) return;

  await commitPatchPlanWithSnapshot(manifestationId, docId, plan);
}
