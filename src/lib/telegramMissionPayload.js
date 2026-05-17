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

/** Payload inviato all'API Telegram (allineato ai campi Firestore missione/evento). */
export function buildMissionTelegramPayload(missione, evento) {
  return {
    idMissione: missione.idMissione ?? '',
    eventoCorrelato: missione.eventoCorrelato ?? '',
    mezzo: missione.mezzo ?? '',
    stato: missione.stato ?? '',
    indirizzo: evento?.indirizzo ?? '',
    tipoEvento: evento?.tipoEvento ?? '',
    dettaglioEvento: evento?.dettaglioEvento ?? '',
    colore: evento?.colore ?? missione.codiceColore ?? '',
    noteMissione: missione.noteMissione ?? '',
  };
}
