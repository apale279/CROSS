/**
 * Match paziente ↔ missione/evento: richiede chiavi non vuote (mai match su stringhe vuote).
 */
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

/** Contesto evento (scheda paziente) per preferire la missione corretta sul mezzo. */
export function eventoRefForMissioneMatch(evento) {
  if (!evento) return null;
  return {
    eventoIdUnivoco: evento.idUnivoco ?? evento.eventoIdUnivoco,
    eventoCorrelato: evento.idEvento ?? evento.eventoCorrelato,
  };
}
