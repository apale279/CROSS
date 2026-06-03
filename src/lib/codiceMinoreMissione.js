import { findEvento } from './eventoLinks';
import { isPercorsoCodiceMinoreTrasporto } from './pmaDestinazioneTrasporto';
import { resolveMissionePaziente } from './pazienteRules';

/** Missione di trasporto collegata a un paziente codice minore (solo percorso trasporto). */
export function missioneCorrelataCodiceMinore(paziente, missioni, eventi) {
  if (!paziente || !isPercorsoCodiceMinoreTrasporto(paziente)) return null;
  const evento = findEvento(eventi, paziente.eventoIdUnivoco ?? paziente.eventoCorrelato);
  return resolveMissionePaziente(missioni, paziente, evento) ?? null;
}
