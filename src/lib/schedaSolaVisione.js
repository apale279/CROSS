import { isPazienteOriginePma, pazientePmaChiuso } from './pmaModule';
import { isChiusoCentrale } from './pazienteStati';

export function isSchedaModificaForzata(paziente) {
  return paziente?.schedaModificaForzata === true;
}

/**
 * Scheda chiusa (centrale o PMA): sola visione salvo sblocco esplicito (`schedaModificaForzata`).
 */
export function isSchedaInSolaVisione(paziente) {
  if (!paziente) return false;
  if (isSchedaModificaForzata(paziente)) return false;
  const pmaChiuso = pazientePmaChiuso(paziente);
  if (isPazienteOriginePma(paziente)) return pmaChiuso;
  return isChiusoCentrale(paziente) || pmaChiuso;
}

/** Modifica consentita (scheda operativa aperta oppure sblocco manuale). */
export function isSchedaModificabile(paziente) {
  return Boolean(paziente) && !isSchedaInSolaVisione(paziente);
}
