import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { statiMissioneNumerati } from './impostazioniLists';

/** Stati missione numerati 0…n (esclusa ANNULLATA) — default da costanti. */
export const STATI_MISSIONE_NUMERATI = DEFAULT_IMPOSTAZIONI.statiMissione.filter(
  (s) => s !== 'ANNULLATA',
);

export function indiceStatoMissione(stato, impostazioni = null) {
  const list = impostazioni ? statiMissioneNumerati(impostazioni) : STATI_MISSIONE_NUMERATI;
  const i = list.indexOf(stato);
  return i >= 0 ? i : null;
}
