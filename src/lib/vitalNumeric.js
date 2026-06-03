/** Valore per input numerico parametro vitale: vuoto se non rilevato. */
export function vitalInputValue(n) {
  if (n === null || n === undefined) return '';
  return n;
}

/**
 * Parsing da input: '' → null; numero valido (incluso 0) → valore.
 * @returns {number|null|undefined} undefined = input non valido, non aggiornare
 */
export function parseVitalNumericInput(raw, { min, max, integer = false } = {}) {
  const v = String(raw ?? '').trim();
  if (v === '') return null;
  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  let x = integer ? Math.floor(n) : n;
  if (min != null) x = Math.max(min, x);
  if (max != null) x = Math.min(max, x);
  return x;
}
