import { isChiusoCentrale, pazienteInElencoAperti } from '../lib/pazienteStati';
import { pazienteHaSchedaPma, pazientePmaAperto } from '../lib/pmaModule';
import { isPercorsoCodiceMinoreTrasporto } from '../lib/pmaDestinazioneTrasporto';
import { esitoMissioneTerminaCopertura } from '../lib/missioneEsito';

/** Missione considerata terminata (fine regolare o annullamento eccezione). */
export function isMissioneTerminata(missione) {
  return (
    missione.aperta === false ||
    missione.stato === 'FINE MISSIONE' ||
    missione.stato === 'ANNULLATA' ||
    esitoMissioneTerminaCopertura(missione.esitoMissione)
  );
}

/**
 * Missione ancora in copertura operativa sull’evento (ALLERTATO, IN POSTO, …).
 * RIENTRO / ARRIVATO H: mezzo libero, evento può andare in operativo terminato, missione resta aperta.
 */
export function missioneAttiva(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return false;
  if (esitoMissioneTerminaCopertura(missione.esitoMissione)) return false;
  const s = missione.stato ?? '';
  if (s === 'FINE MISSIONE' || s === 'ANNULLATA') return false;
  if (s === 'RIENTRO' || s === 'ARRIVATO H') return false;
  return true;
}

/** Tutte le missioni consentono la chiusura operativa dell’evento (rientro o fine/annullo). */
export function missioneConsenteChiusuraEvento(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return true;
  const s = missione.stato ?? '';
  return s === 'RIENTRO' || s === 'FINE MISSIONE' || s === 'ANNULLATA';
}

/**
 * Paziente che impedisce la chiusura operativa centrale dell’evento.
 * Chi è già concluso in missione/trasporto ma ancora in tenda PMA non blocca
 * (come E68/E70 con ARRIVATO H + IN ARRIVO / in carico).
 */
export function pazienteBloccaChiusuraOperativaEvento(paziente) {
  if (!pazienteInElencoAperti(paziente)) return false;
  if (
    isChiusoCentrale(paziente) &&
    isPercorsoCodiceMinoreTrasporto(paziente)
  ) {
    return false;
  }
  if (
    isChiusoCentrale(paziente) &&
    pazienteHaSchedaPma(paziente) &&
    pazientePmaAperto(paziente)
  ) {
    return false;
  }
  return true;
}

export function eventoHaPazientiAperti(pazientiCollegate) {
  return (pazientiCollegate ?? []).some(pazienteBloccaChiusuraOperativaEvento);
}

/**
 * `operativoTerminato` quando tutte le missioni sono in rientro/fine/annullo,
 * almeno una in RIENTRO o FINE MISSIONE (non solo ANNULLATE),
 * e nessun paziente ancora in gestione centrale sull’evento.
 */
export function shouldAutoCloseEvento(missioniCollegate, pazientiCollegate = []) {
  if (!missioniCollegate?.length) return false;
  if (eventoHaPazientiAperti(pazientiCollegate)) return false;
  if (!missioniCollegate.every(missioneConsenteChiusuraEvento)) return false;
  return missioniCollegate.some(
    (m) => m.stato === 'FINE MISSIONE' || m.stato === 'RIENTRO',
  );
}
