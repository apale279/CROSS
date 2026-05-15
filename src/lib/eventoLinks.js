import { missioneAttiva } from '../utils/eventoAutoClose';

/** Missioni collegate a un evento (idUnivoco + compatibilità dati vecchi). */
export function missioniPerEvento(missioni, evento) {
  if (!evento) return [];
  const uid = evento.idUnivoco;
  const displayId = evento.idEvento;
  return missioni.filter((m) => {
    if (uid && m.eventoIdUnivoco) return m.eventoIdUnivoco === uid;
    return m.eventoCorrelato === displayId;
  });
}

/**
 * Evento aperto senza missioni attive (nessuna copertura in corso).
 * Utile per segnalare “orfano logistico” dopo dirottamento / annulli.
 */
export function eventoSenzaCoperturaMissione(missioni, evento) {
  if (!evento) return false;
  const list = missioniPerEvento(missioni, evento);
  if (!list.length) return true;
  return !list.some((m) => missioneAttiva(m));
}

/** Pazienti collegati a un evento. */
export function pazientiPerEvento(pazienti, evento) {
  if (!evento) return [];
  const uid = evento.idUnivoco;
  const displayId = evento.idEvento;
  return pazienti.filter((p) => {
    if (uid && p.eventoIdUnivoco) return p.eventoIdUnivoco === uid;
    return p.eventoCorrelato === displayId;
  });
}

/** Trova evento da riferimento missione / click dashboard. */
export function findEvento(eventi, ref) {
  if (!ref) return null;
  if (typeof ref === 'object') return ref;
  return (
    eventi.find(
      (e) => e.idUnivoco === ref || e.idEvento === ref || e._docId === ref,
    ) ?? null
  );
}
