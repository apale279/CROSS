import { normalizeMsbDetails } from './msbValutazione';
import {
  emptyMsaAcc,
  emptyMsaDetails,
  emptyMsaParametri,
  normalizeMsaAcc,
  normalizeMsaDetails,
  normalizeMsaParametri,
} from './msaValutazione';
import { emptyMsbDetails } from './msbValutazione';

function jsonEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Normalizza un solo campo di msbDetails (coerente con normalizeMsbDetails). */
export function normalizeMsbDetailField(key, value) {
  const merged = normalizeMsbDetails({ ...emptyMsbDetails(), [key]: value });
  return merged[key];
}

/** Normalizza un solo campo top-level di msaDetails. */
export function normalizeMsaDetailField(key, value) {
  const merged = normalizeMsaDetails({ ...emptyMsaDetails(), [key]: value });
  return merged[key];
}

/** Normalizza un solo campo di msaDetails.parametri. */
export function normalizeMsaParametriField(key, value) {
  const merged = normalizeMsaParametri({ ...emptyMsaParametri(), [key]: value });
  return merged[key];
}

/** Normalizza un solo campo di msaDetails.acc / msbDetails.acc. */
export function normalizeMsaAccField(key, value) {
  const merged = normalizeMsaAcc({ ...emptyMsaAcc(), [key]: value });
  return merged[key];
}

function diffNestedObject(updates, prefix, currentParent, partialParent, normalizeField) {
  if (!partialParent || typeof partialParent !== 'object') return;
  const current = currentParent && typeof currentParent === 'object' ? currentParent : {};
  for (const [key, raw] of Object.entries(partialParent)) {
    const next = normalizeField(key, raw);
    if (!jsonEqual(current[key], next)) {
      updates[`${prefix}.${key}`] = next;
    }
  }
}

/**
 * Costruisce `update()` Firestore con path puntati: solo le foglie presenti in `payload` e cambiate.
 * Non riscrive msbDetails/msaDetails interi se cambia una sola sottochiave.
 *
 * @param {Record<string, unknown>} current — documento Firestore esistente
 * @param {Record<string, unknown>} payload — patch da UI (es. `{ msbDetails: { presidi: [...] } }`)
 * @returns {Record<string, unknown>}
 */
export function buildValutazioneGranularUpdates(current, payload) {
  const updates = {};
  if (!payload || typeof payload !== 'object') return updates;

  for (const [key, value] of Object.entries(payload)) {
    if (key === 'msbDetails' || key === 'msaDetails') continue;
    if (!jsonEqual(current?.[key], value)) {
      updates[key] = value;
    }
  }

  const msbPartial = payload.msbDetails;
  if (msbPartial && typeof msbPartial === 'object') {
    const curMsb = current?.msbDetails && typeof current.msbDetails === 'object' ? current.msbDetails : {};
    for (const [key, raw] of Object.entries(msbPartial)) {
      if (key === 'acc') {
        diffNestedObject(updates, 'msbDetails.acc', curMsb.acc, raw, normalizeMsaAccField);
        continue;
      }
      const next = normalizeMsbDetailField(key, raw);
      if (!jsonEqual(curMsb[key], next)) {
        updates[`msbDetails.${key}`] = next;
      }
    }
  }

  const msaPartial = payload.msaDetails;
  if (msaPartial && typeof msaPartial === 'object') {
    const curMsa = current?.msaDetails && typeof current.msaDetails === 'object' ? current.msaDetails : {};
    for (const [key, raw] of Object.entries(msaPartial)) {
      if (key === 'parametri') {
        diffNestedObject(
          updates,
          'msaDetails.parametri',
          curMsa.parametri,
          raw,
          normalizeMsaParametriField,
        );
        continue;
      }
      if (key === 'acc') {
        diffNestedObject(updates, 'msaDetails.acc', curMsa.acc, raw, normalizeMsaAccField);
        continue;
      }
      const next = normalizeMsaDetailField(key, raw);
      if (!jsonEqual(curMsa[key], next)) {
        updates[`msaDetails.${key}`] = next;
      }
    }
  }

  return updates;
}
