import { isPazienteOriginePma, pazientePmaChiuso } from './pmaModule';
import { isChiusoCentrale } from './pazienteStati';

export function isSchedaModificaForzata(paziente) {
  return paziente?.schedaModificaForzata === true;
}

/** Scheda chiusa (centrale o PMA): sola visione salvo sblocco esplicito. */
export function isSchedaInSolaVisione(paziente) {
  if (!paziente) return false;
  if (isSchedaModificaForzata(paziente)) return false;
  if (isPazienteOriginePma(paziente)) {
    return pazientePmaChiuso(paziente);
  }
  return isChiusoCentrale(paziente) || pazientePmaChiuso(paziente);
}
