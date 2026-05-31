/** Match paziente ↔ missione (admin/Telegram): allineato al client `pazienteSuMissione`. */

function normalizeMezzoKey(sigla) {
  return String(sigla ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '');
}

export function pazienteSameEventoAsMissione(paziente, missione) {
  if (!paziente || !missione) return false;

  const uidP = String(paziente.eventoIdUnivoco ?? '').trim();
  const uidM = String(missione.eventoIdUnivoco ?? '').trim();
  if (uidM && uidP && uidP === uidM) return true;

  const dispP = String(paziente.eventoCorrelato ?? '').trim();
  const dispM = String(missione.eventoCorrelato ?? '').trim();
  if (dispM && dispP && dispP === dispM) return true;

  return false;
}

/** Legame canonico paziente ↔ missione (non solo sigla mezzo). */
export function pazienteSuMissione(paziente, missione) {
  if (!paziente || !missione || !pazienteSameEventoAsMissione(paziente, missione)) return false;
  const uidM = String(missione.idUnivoco ?? '').trim();
  const uidP = String(paziente.missioneIdUnivoco ?? '').trim();
  if (uidM && uidP && uidP === uidM) return true;
  const idM = String(missione.idMissione ?? '').trim();
  const idP = String(paziente.idMissione ?? '').trim();
  if (idM && idP && idP === idM) {
    if (!paziente.mezzo || !missione.mezzo) return true;
    return normalizeMezzoKey(paziente.mezzo) === normalizeMezzoKey(missione.mezzo);
  }
  return false;
}

export function pazienteMatchesMissioneTrasporto(p, missione) {
  return p?.esito === 'Trasporta' && pazienteSuMissione(p, missione);
}
