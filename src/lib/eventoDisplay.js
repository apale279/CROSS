/** Tipo e dettaglio evento: evento Firestore, poi copia su paziente / pmaScheda. */
export function pazienteEventoTipoDettaglio(paziente, evento) {
  const scheda = paziente?.pmaScheda ?? {};
  return {
    tipo: String(
      evento?.tipoEvento ?? scheda.tipo_evento ?? paziente?.tipo_evento ?? '',
    ).trim(),
    dettaglio: String(
      evento?.dettaglioEvento ?? scheda.dettaglio_evento ?? paziente?.dettaglio_evento ?? '',
    ).trim(),
  };
}

/** Testo colonna «Indirizzo» in dashboard: luogo fisico se presente, altrimenti indirizzo. */
export function eventoColonnaIndirizzo(ev) {
  const luogo = (ev?.luogo_fisico ?? '').trim();
  if (luogo) return luogo;
  return (ev?.indirizzo ?? '').trim();
}
