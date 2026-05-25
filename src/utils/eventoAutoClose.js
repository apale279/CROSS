import { pazienteInElencoAperti } from '../lib/pazienteStati';

/** Missione considerata terminata (fine regolare o annullamento eccezione). */
export function isMissioneTerminata(missione) {
  return (
    missione.aperta === false ||
    missione.stato === 'FINE MISSIONE' ||
    missione.stato === 'ANNULLATA'
  );
}

/**
 * Missione ancora in copertura operativa sull’evento (ALLERTATO, IN POSTO, …).
 * RIENTRO / ARRIVATO H: mezzo libero, evento può andare in operativo terminato, missione resta aperta.
 */
export function missioneAttiva(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return false;
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

export function eventoHaPazientiAperti(pazientiCollegate) {
  return (pazientiCollegate ?? []).some(pazienteInElencoAperti);
}

/**
 * `operativoTerminato` quando tutte le missioni sono in rientro/fine/annullo,
 * almeno una in RIENTRO o FINE MISSIONE (non solo ANNULLATE),
 * e nessun paziente ancora aperto sull’evento.
 */
export function shouldAutoCloseEvento(missioniCollegate, pazientiCollegate = []) {
  if (!missioniCollegate?.length) return false;
  if (eventoHaPazientiAperti(pazientiCollegate)) return false;
  if (!missioniCollegate.every(missioneConsenteChiusuraEvento)) return false;
  return missioniCollegate.some(
    (m) => m.stato === 'FINE MISSIONE' || m.stato === 'RIENTRO',
  );
}
