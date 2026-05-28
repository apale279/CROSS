import { omitUndefinedFields } from './firestorePatch';

/** Firestore FieldValue (deleteField, serverTimestamp, …). */
export function isFirestoreFieldValue(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ('_methodName' in value || value.constructor?.name === 'FieldValue')
  );
}

/** Oggetti annidati su paziente: vietato riscriverli interi con patchPaziente. */
export const PAZIENTE_NESTED_OBJECT_FIELDS = new Set(['pmaScheda', 'valutazioniSoccorso']);

/** Oggetti annidati su mezzo espansi in path puntati (equipaggio.*, stazionamento.*). */
const MEZZO_FLATTEN_OBJECT_FIELDS = new Set(['equipaggio', 'stazionamento']);

export function assertPazientePatchGranular(fields) {
  for (const key of Object.keys(fields ?? {})) {
    if (PAZIENTE_NESTED_OBJECT_FIELDS.has(key)) {
      throw new Error(
        `Salvataggio intero di «${key}» non consentito sul paziente: usare patchPazientePmaGranular o API puntate.`,
      );
    }
  }
}

/** Valori annidati scritti come singolo campo Firestore (es. GeoPoint). */
const MEZZO_ATOMIC_NESTED_KEYS = new Set(['coordinate']);

function flattenMezzoNestedObject(prefix, value, out) {
  for (const [subKey, subValue] of Object.entries(value ?? {})) {
    const path = `${prefix}.${subKey}`;
    if (
      MEZZO_ATOMIC_NESTED_KEYS.has(subKey) ||
      subValue == null ||
      typeof subValue !== 'object' ||
      isFirestoreFieldValue(subValue)
    ) {
      out[path] = subValue;
      continue;
    }
    flattenMezzoNestedObject(path, subValue, out);
  }
}

/**
 * Converte patch mezzo con oggetti annidati in update puntati (equipaggio.medico.nome, …).
 */
export function flattenMezzoPatchFields(fields) {
  const out = {};
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (
      MEZZO_FLATTEN_OBJECT_FIELDS.has(key) &&
      value &&
      typeof value === 'object' &&
      !isFirestoreFieldValue(value)
    ) {
      flattenMezzoNestedObject(key, value, out);
      continue;
    }
    out[key] = value;
  }
  return omitUndefinedFields(out);
}
