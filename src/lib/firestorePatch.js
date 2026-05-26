/**
 * Rimuove chiavi con valore `undefined` prima di updateDoc/setDoc (Firestore le rifiuta).
 * @param {Record<string, unknown>} fields
 */
export function omitUndefinedFields(fields) {
  if (!fields || typeof fields !== 'object') return {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) out[key] = value;
  }
  return out;
}
