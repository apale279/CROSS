/** Confronto stabile per confermare la scrittura Firestore (evita falsi negativi su oggetti). */
export function impostazioniValuesMatch(a, b) {
  return JSON.stringify(normalizeForCompare(a)) === JSON.stringify(normalizeForCompare(b));
}

function normalizeForCompare(value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (typeof value === 'object' && value.toDate) {
    return value.toDate().getTime();
  }
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = normalizeForCompare(value[key]);
        return acc;
      }, {});
  }
  return value;
}
