import { schedaTabDimissioneAllows } from '@pma/lib/rankMatrix';
import { isPazienteOriginePma, pazienteHaSchedaPma, pazientePmaChiuso } from './pmaModule';
import { isChiusoCentrale } from './pazienteStati';

export function isSchedaModificaForzata(paziente) {
  return paziente?.schedaModificaForzata === true;
}

/**
 * Scheda chiusa (centrale o PMA): sola visione salvo sblocco esplicito.
 * @param {{ userRank?: string | null }} [options] — rank operatore (Medico/Centrale può modificare dimessi PMA).
 */
export function isSchedaInSolaVisione(paziente, options = {}) {
  if (!paziente) return false;
  if (isSchedaModificaForzata(paziente)) return false;
  const rank = options.userRank ?? null;
  const pmaChiuso = pazientePmaChiuso(paziente);
  const mayEditDimessoPma =
    pmaChiuso && rank && schedaTabDimissioneAllows(rank, 'UPDATE') && pazienteHaSchedaPma(paziente);

  if (isPazienteOriginePma(paziente)) {
    if (mayEditDimessoPma) return false;
    return pmaChiuso;
  }
  if (mayEditDimessoPma) return false;
  return isChiusoCentrale(paziente) || pmaChiuso;
}
