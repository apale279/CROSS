import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { isMissionePmaInvioPs } from './pmaInvioPsMission';

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

/** Codice colore valido oppure `null` se assente / non impostato (M, T). */
export function parseCodiceColoreOptional(raw) {
  const c = String(raw ?? '').trim();
  return DEFAULT_IMPOSTAZIONI.coloriEvento.includes(c) ? c : null;
}

export function gravitaIndice(colore) {
  return GRAVITA_INDICE[normalizeCodiceColore(colore)] ?? 0;
}

/** Restituisce il codice più grave tra quelli forniti. */
/** Colore sanitario più grave tra valutazioni MSB/MSA (sottocollezione o draft). */
export function codiceColoreSanitarioFromValutazioni(rows) {
  const colori = [];
  for (const v of rows ?? []) {
    if (v?.tipo === 'MSB') {
      const c = parseCodiceColoreOptional(v.msbDetails?.codiceColore);
      if (c) colori.push(c);
    } else if (v?.tipo === 'MSA') {
      const c = parseCodiceColoreOptional(v.msaDetails?.codiceColore);
      if (c) colori.push(c);
    }
  }
  if (!colori.length) return null;
  return pickGravestColore(colori);
}

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

/** M — solo `codiceColoreMissione` esplicito (ignora legacy `codiceColore`). */
export function resolveCodiceColoreMissione(missione) {
  return parseCodiceColoreOptional(missione?.codiceColoreMissione);
}

/** Codice colore sanitario esplicito sul paziente (`codiceColoreSanitario`). */
export function codiceColoreSanitarioPaziente(paziente) {
  return parseCodiceColoreOptional(paziente?.codiceColoreSanitario);
}

/** Codici sanitari espliciti sui pazienti in trasporto (campo `codiceColoreSanitario`). */
export function codiciColoreSanitariPazienti(pazientiTrasporto = []) {
  return (pazientiTrasporto ?? [])
    .map((p) => codiceColoreSanitarioPaziente(p))
    .filter(Boolean);
}

/**
 * Colore T (trasporto verso ospedale).
 * Centrale: solo da `codiceColoreSanitario` paziente (mai da T manuale missione).
 * PMA → PS: da missione (modificabile a mano su scheda missione).
 */
export function resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto = []) {
  if (isMissionePmaInvioPs(missione)) {
    if (missione?.codiceColoreTrasportoManuale === true) {
      return parseCodiceColoreOptional(missione?.codiceColoreTrasporto);
    }
    const fromMissione =
      parseCodiceColoreOptional(missione?.codiceColoreTrasporto) ??
      parseCodiceColoreOptional(missione?.codiceColoreMissione);
    if (fromMissione) return fromMissione;
    return parseCodiceColoreOptional(evento?.colore);
  }

  const fromPaz = codiciColoreSanitariPazienti(pazientiTrasporto);
  if (fromPaz.length) return pickGravestColore(fromPaz);
  return null;
}

/** Colore di riga dashboard: priorità trasporto → missione → evento. */
export function coloreRigaDashboard(missione, evento, pazientiTrasporto = []) {
  return (
    resolveCodiceColoreTrasporto(missione, evento, pazientiTrasporto) ??
    resolveCodiceColoreMissione(missione) ??
    resolveCodiceColoreEvento(evento)
  );
}
