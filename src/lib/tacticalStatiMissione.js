import { DEFAULT_IMPOSTAZIONI } from '../constants';

/** Stati missione numerati 0…n (esclusa ANNULLATA) per tabellone tattico. */
export const STATI_MISSIONE_NUMERATI = DEFAULT_IMPOSTAZIONI.statiMissione.filter(
  (s) => s !== 'ANNULLATA',
);

export function indiceStatoMissione(stato) {
  const i = STATI_MISSIONE_NUMERATI.indexOf(stato);
  return i >= 0 ? i : null;
}
