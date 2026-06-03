/**
 * Parametri vitali: null / '' = non rilevato; 0 non è una misura valida (UI vuota, DB null).
 */

/** Valore per input: vuoto se assente o zero (non confondere con misura reale). */
export function vitalInputValue(n) {
  if (n === null || n === undefined || n === 0) return '';
  return n;
}

/**
 * Normalizza valore letto da Firestore / oggetto salvato.
 * @returns {number|null}
 */
export function vitalMeasuredOrNull(raw, { max = Infinity, min = -Infinity, integer = false } = {}) {
  if (raw === null || raw === undefined || raw === '') return null;
  const x = Number(raw);
  if (!Number.isFinite(x) || x === 0) return null;
  let n = integer ? Math.floor(x) : x;
  if (max !== Infinity && n > max) n = max;
  if (min !== -Infinity && n < min) n = min;
  if (n === 0) return null;
  return integer ? Math.floor(n) : Math.round(n * 1000) / 1000;
}

/**
 * Parsing da input operatore: '' → null; «0» → null; numero valido → valore.
 * @returns {number|null|undefined} undefined = input non valido, non aggiornare
 */
export function parseVitalNumericInput(raw, { min, max, integer = false } = {}) {
  const v = String(raw ?? '').trim();
  if (v === '') return null;
  const n = Number(v.replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  if (n === 0) return null;
  let x = integer ? Math.floor(n) : n;
  if (min != null) x = Math.max(min, x);
  if (max != null) x = Math.min(max, x);
  if (x === 0) return null;
  return x;
}
