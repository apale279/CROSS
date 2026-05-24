import { doc, runTransaction, updateDoc } from 'firebase/firestore';
import { db } from '../cross/firebase';
import { pazientiPath } from '../../lib/firestorePaths';
import { normalizePazientePatchInput, splitPazientePatch } from '../adapters/crossPazienteAdapter';
import { EMPTY_PMA_SCHEDA } from './pmaSchedaDefaults';

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

function isFirestoreFieldValue(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('_methodName' in value || value.constructor?.name === 'FieldValue')
  );
}

/**
 * Merge array per `id`: aggiorna/aggiunge voci client; se il client invia un sottoinsieme
 * (es. eliminazione farmaco) prevale la lista client per quella operazione.
 */
export function mergeSchedaArrayById(serverArr, clientArr) {
  const server = Array.isArray(serverArr) ? serverArr : [];
  const client = Array.isArray(clientArr) ? clientArr : [];

  const serverIds = new Set(server.map((x) => x?.id).filter(Boolean));
  const clientIds = new Set(client.map((x) => x?.id).filter(Boolean));
  const clientHasIds = clientIds.size > 0;

  if (clientHasIds) {
    const clientSubset = [...clientIds].every((id) => serverIds.has(id));
    if (clientSubset && client.length < server.length) {
      return client;
    }
    const byId = new Map();
    for (const item of server) {
      if (item?.id) byId.set(item.id, item);
    }
    for (const item of client) {
      if (item?.id) byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }

  if (typeof client[0] === 'string' || typeof server[0] === 'string') {
    return client;
  }

  return client.length ? client : server;
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

/**
 * Aggiornamento granulare: scalari/EO con dot-path; array con transazione + merge per id.
 */
export async function patchPazientePmaGranular(manifestationId, docId, patch) {
  if (!manifestationId || !docId || !patch) return;

  const safePatch = normalizePazientePatchInput(patch);
  if (safePatch.pmaScheda && typeof safePatch.pmaScheda === 'object') {
    throw new Error('Aggiornamento pmaScheda intero non consentito: usare campi singoli.');
  }

  const fields = flattenPazientePatchForFirestore(safePatch);
  if (Object.prototype.hasOwnProperty.call(fields, 'pmaScheda')) {
    throw new Error('Aggiornamento documento PMA non granulare bloccato.');
  }
  const direct = {};
  const arrayTxn = [];

  for (const [path, value] of Object.entries(fields)) {
    if (!path.startsWith(PMA_SCHEDA_PREFIX)) {
      direct[path] = value;
      continue;
    }
    const field = path.slice(PMA_SCHEDA_PREFIX.length);
    if (PMA_SCHEDA_ARRAY_FIELDS.has(field) && !isFirestoreFieldValue(value)) {
      arrayTxn.push({ field, value });
    } else {
      direct[path] = value;
    }
  }

  const docRef = doc(db, ...pazientiPath(manifestationId), docId);

  if (Object.keys(direct).length > 0) {
    await updateDoc(docRef, direct);
  }

  for (const { field, value } of arrayTxn) {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) return;
      const raw = snap.data().pmaScheda?.[field];
      const merged =
        field === 'prestazioni_sel'
          ? Array.isArray(value)
            ? value
            : raw
          : mergeSchedaArrayById(raw, value);
      transaction.update(docRef, { [`pmaScheda.${field}`]: merged });
    });
  }
}
