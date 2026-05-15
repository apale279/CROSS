/** Missione considerata terminata (fine regolare o annullamento eccezione). */
export function isMissioneTerminata(missione) {
  return (
    missione.aperta === false ||
    missione.stato === 'FINE MISSIONE' ||
    missione.stato === 'ANNULLATA'
  );
}

/** Missione ancora in carico (copertura sull’evento). */
export function missioneAttiva(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return false;
  if (missione.stato === 'FINE MISSIONE' || missione.stato === 'ANNULLATA') return false;
  return true;
}

/**
 * Chiude l'evento solo se esiste almeno una missione e tutte sono terminate
 * **e** almeno una missione è chiusa con FINE MISSIONE.
 * Così un evento resta aperto se restano solo missioni ANNULLATE (es. dirottamento / flag-down senza copertura sull’evento originario).
 */
export function shouldAutoCloseEvento(missioniCollegate) {
  if (!missioniCollegate?.length) return false;
  if (!missioniCollegate.every(isMissioneTerminata)) return false;
  return missioniCollegate.some((m) => m.stato === 'FINE MISSIONE');
}
