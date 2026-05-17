/** Testo stazionamento per liste (indirizzo, altrimenti luogo fisico). */
export function mezzoStazionamentoLabel(mezzo) {
  const s = mezzo?.stazionamento;
  const indirizzo = (s?.indirizzo ?? '').trim();
  if (indirizzo) return indirizzo;
  const luogo = (s?.luogo_fisico ?? '').trim();
  if (luogo) return luogo;
  return (mezzo?.dettaglio_stazionamento ?? '').trim();
}
