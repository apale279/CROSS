import { buildStatoChangeFields } from './missionStoricoStati';
import { isMissioneTerminata } from '../utils/eventoAutoClose';

/** Missione da aggiornare in chiusura forzata evento (salta già chiuse). */
export function missioneRichiedeChiusuraSuEventoForzato(missione) {
  if (!missione) return false;
  if (missione.aperta === false && isMissioneTerminata(missione)) return false;
  return true;
}

/**
 * Patch missione in chiusura forzata: ANNULLATA/FINE MISSIONE restano tali (solo `aperta: false`).
 * Le altre passano a FINE MISSIONE.
 */
export function fieldsChiusuraMissioneSuEventoForzato(missione) {
  const stato = missione?.stato ?? '';
  if (stato === 'FINE MISSIONE' || stato === 'ANNULLATA') {
    return { aperta: false };
  }
  return buildStatoChangeFields(missione, 'FINE MISSIONE');
}
