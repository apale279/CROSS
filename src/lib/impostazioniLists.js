import { DEFAULT_IMPOSTAZIONI } from '../constants';

export function resolveStatiMissione(impostazioni) {
  const list = impostazioni?.statiMissione;
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_IMPOSTAZIONI.statiMissione;
}

export function resolveColoriEvento(impostazioni) {
  const list = impostazioni?.coloriEvento;
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_IMPOSTAZIONI.coloriEvento;
}

export function statiMissioneNumerati(impostazioni) {
  return resolveStatiMissione(impostazioni).filter((s) => s !== 'ANNULLATA');
}

export function coloriEventoValidiSet(impostazioni) {
  return new Set(resolveColoriEvento(impostazioni));
}

export function isColoreEventoValido(colore, impostazioni) {
  const c = String(colore ?? '').trim();
  if (!c) return false;
  return coloriEventoValidiSet(impostazioni).has(c);
}
