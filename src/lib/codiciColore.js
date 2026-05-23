import { DEFAULT_IMPOSTAZIONI } from '../constants';

/** Indice gravità crescente: il valore più alto vince (Rosso più grave di Giallo, ecc.). */
export const GRAVITA_INDICE = {
  Bianco: 0,
  Verde: 1,
  Giallo: 2,
  Rosso: 3,
};

export function normalizeCodiceColore(raw, fallback = 'Bianco') {
  const c = String(raw ?? '').trim();
  return DEFAULT_IMPOSTAZIONI.coloriEvento.includes(c) ? c : fallback;
}

export function gravitaIndice(colore) {
  return GRAVITA_INDICE[normalizeCodiceColore(colore)] ?? 0;
}

/** Restituisce il codice più grave tra quelli forniti. */
export function pickGravestColore(colori) {
  const list = (colori ?? []).map((c) => normalizeCodiceColore(c)).filter(Boolean);
  if (!list.length) return 'Bianco';
  return list.reduce((best, c) =>
    gravitaIndice(c) > gravitaIndice(best) ? c : best,
  );
}

export function resolveCodiceColoreEvento(evento) {
  return normalizeCodiceColore(evento?.colore);
}

export function resolveCodiceColoreMissione(missione, evento) {
  const m = missione?.codiceColoreMissione ?? missione?.codiceColore;
  if (m) return normalizeCodiceColore(m);
  return resolveCodiceColoreEvento(evento);
}

export function resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto = []) {
  const stored = missione?.codiceColoreTrasporto;
  if (stored) return normalizeCodiceColore(stored);
  const fromPaz = (pazientiTrasporto ?? []).map(
    (p) => p.codiceColoreSanitario ?? p.codiceColore,
  );
  if (fromPaz.length) return pickGravestColore(fromPaz);
  return resolveCodiceColoreEvento(evento);
}

/** Colore di riga dashboard: priorità trasporto → missione → evento. */
export function coloreRigaDashboard(missione, evento, pazientiTrasporto = []) {
  return resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto);
}
