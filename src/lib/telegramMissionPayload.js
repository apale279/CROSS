/** Trova l'evento collegato a una missione (per indirizzo / motivo). */
export function findEventoForMissione(eventi, missione) {
  if (!missione || !eventi?.length) return null;
  const correlato = missione.eventoCorrelato;
  const idUnivoco = missione.eventoIdUnivoco;
  return (
    eventi.find(
      (e) =>
        e.idEvento === correlato ||
        e.idUnivoco === idUnivoco ||
        e._docId === idUnivoco ||
        e._docId === correlato,
    ) ?? null
  );
}

function serializeTimestamp(ts) {
  if (!ts) return '';
  if (typeof ts === 'string') return ts;
  if (typeof ts === 'number') return new Date(ts).toISOString();
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString();
  const sec = ts.seconds ?? ts._seconds;
  if (sec != null) return new Date(Number(sec) * 1000).toISOString();
  return '';
}

function pickEventoForTelegram(evento) {
  if (!evento) return {};
  return {
    tipoEvento: evento.tipoEvento ?? '',
    luogo: evento.luogo ?? '',
    tipoLuogo: evento.tipoLuogo ?? '',
    indirizzo: evento.indirizzo ?? '',
    noteEvento: evento.noteEvento ?? '',
    coordinate: evento.coordinate ?? null,
  };
}

function pickMissioneForTelegram(missione) {
  if (!missione) return {};
  return {
    idMissione: missione.idMissione ?? '',
    apertura: serializeTimestamp(missione.apertura),
    stato: missione.stato ?? '',
    mezzo: missione.mezzo ?? '',
    codiceColoreMissione:
      missione.codiceColoreMissione ?? missione.codiceColore ?? '',
    aperta: missione.aperta !== false,
  };
}

/** Payload inviato all'API Telegram. */
export function buildMissionTelegramPayload(missione, evento) {
  const ev = pickEventoForTelegram(evento);
  const mi = pickMissioneForTelegram(missione);
  return {
    missionDocId: missione._docId ?? '',
    aperta: mi.aperta,
    mezzo: mi.mezzo,
    stato: mi.stato,
    idMissione: mi.idMissione,
    apertura: mi.apertura,
    evento: ev,
    missione: mi,
    indirizzo: ev.indirizzo,
    tipoEvento: ev.tipoEvento,
    coordinate: ev.coordinate,
    colore: mi.codiceColoreMissione,
  };
}
