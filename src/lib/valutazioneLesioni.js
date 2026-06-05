import { normalizeValutazioniMsbMsaImpostazioni } from './valutazioneMsbMsaLists';

/** Riga lesione MSB/MSA: [localizzazione, lato SN|DX, tipologia, vas 0..max]. */
export const LESIONE_LATI = ['SN', 'DX'];

/**
 * @typedef {[string, string, string, number | null]} LesioneTuple
 */

export function emptyLesioneTuple() {
  return ['', '', '', null];
}

function clampVas(raw, max = 10) {
  if (raw === null || raw === undefined || raw === '') return null;
  const x = Number(raw);
  if (!Number.isFinite(x)) return null;
  const m = Math.max(0, Math.min(max, Math.floor(x)));
  return m;
}

function normLato(raw) {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (t === 'SN' || t === 'DX') return t;
  return '';
}

function rowFromObject(o) {
  if (!o || typeof o !== 'object') return emptyLesioneTuple();
  return [
    String(o.localizzazione ?? o.loc ?? '').trim(),
    normLato(o.lato ?? o.latoSnDx),
    String(o.tipologia ?? o.tipo ?? '').trim(),
    clampVas(o.vas ?? o.VAS),
  ];
}

/** Tuple in memoria/UI. In Firestore usare {@link lesioniToFirestoreRows}. */
export function normalizeLesioni(raw, vasMax = 10) {
  if (!Array.isArray(raw)) return [];
  const max = Number.isFinite(vasMax) && vasMax >= 1 ? Math.floor(vasMax) : 10;
  return raw.map((item) => {
    if (Array.isArray(item)) {
      return [
        String(item[0] ?? '').trim(),
        normLato(item[1]),
        String(item[2] ?? '').trim(),
        clampVas(item[3], max),
      ];
    }
    return rowFromObject(item);
  });
}

/** Righe lesione serializzate per Firestore (array di oggetti, no array annidati). */
export function lesioniToFirestoreRows(raw, vasMax = 10) {
  return normalizeLesioni(raw, vasMax).map(([localizzazione, lato, tipologia, vas]) => ({
    localizzazione,
    lato,
    tipologia,
    vas,
  }));
}

export function normalizeLesioniImpostazioni(raw) {
  return normalizeValutazioniMsbMsaImpostazioni(raw);
}

export function listaLesioniLocalizzazioni(impostazioni) {
  const list = impostazioni?.lesioniLocalizzazioni;
  return Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : [];
}

export function listaLesioniTipologie(impostazioni) {
  const list = impostazioni?.lesioniTipologie;
  return Array.isArray(list) ? list.map((s) => String(s).trim()).filter(Boolean) : [];
}

export function lesioniVasMax(impostazioni) {
  const n = Number(impostazioni?.lesioniVasMax);
  return Number.isFinite(n) && n >= 1 ? Math.min(10, Math.floor(n)) : 10;
}
