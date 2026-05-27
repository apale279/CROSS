import { missioneAttiva } from '../utils/eventoAutoClose';

function missioneCollegataAEvento(m, evento) {
  if (!evento || !m) return false;
  const uid = evento.idUnivoco;
  const displayId = evento.idEvento;
  if (uid && m.eventoIdUnivoco && m.eventoIdUnivoco === uid) return true;
  if (displayId && m.eventoCorrelato === displayId) return true;
  return false;
}

/** Missioni collegate a un evento (idUnivoco + idEvento; entrambi i criteri se disponibili). */
export function missioniPerEvento(missioni, evento) {
  if (!evento) return [];
  return (missioni ?? []).filter((m) => missioneCollegataAEvento(m, evento));
}

/**
 * Missione ancora «in servizio» sull’evento (aperta, non fine/annullata).
 * Include IN POSTO, ARRIVATO H, RIENTRO — il mezzo resta legato all’evento.
 */
export function missioneCoperturaEvento(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return false;
  const s = missione.stato ?? '';
  return s !== 'FINE MISSIONE' && s !== 'ANNULLATA';
}

/**
 * Evento aperto senza missioni attive (nessuna copertura in corso).
 * Utile per segnalare “orfano logistico” dopo dirottamento / annulli.
 */
export function eventoSenzaCoperturaMissione(missioni, evento) {
  if (!evento) return false;
  const list = missioniPerEvento(missioni, evento);
  if (!list.length) return true;
  return !list.some((m) => missioneCoperturaEvento(m));
}

/** Pazienti collegati a un evento. */
export function pazientiPerEvento(pazienti, evento) {
  if (!evento) return [];
  const uid = evento.idUnivoco;
  const displayId = evento.idEvento;
  return (pazienti ?? []).filter((p) => {
    if (uid && p.eventoIdUnivoco && p.eventoIdUnivoco === uid) return true;
    if (displayId && p.eventoCorrelato === displayId) return true;
    return false;
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

/** Eventi ancora aperti (`stato !== false`), non chiusi dall’operatore. */
export function isEventoAperto(evento) {
  return evento?.stato !== false;
}

/** Fase operativa conclusa (rientro / fine missioni), evento ancora «aperto» in archivio. */
export function isEventoOperativoTerminato(evento) {
  return isEventoAperto(evento) && evento?.operativoTerminato === true;
}

/**
 * Ordine elenco eventi aperti: prima in corso, poi operativo terminati in fondo;
 * dentro ogni gruppo, apertura più recente prima.
 */
export function compareEventiAperti(a, b) {
  const termA = isEventoOperativoTerminato(a) ? 1 : 0;
  const termB = isEventoOperativoTerminato(b) ? 1 : 0;
  if (termA !== termB) return termA - termB;
  return (b.apertura?.toMillis?.() ?? 0) - (a.apertura?.toMillis?.() ?? 0);
}

export function sortEventiAperti(eventi) {
  return [...(eventi ?? [])].filter(isEventoAperto).sort(compareEventiAperti);
}
