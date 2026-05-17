/** Testo colonna «Indirizzo» in dashboard: luogo fisico se presente, altrimenti indirizzo. */
export function eventoColonnaIndirizzo(ev) {
  const luogo = (ev?.luogo_fisico ?? '').trim();
  if (luogo) return luogo;
  return (ev?.indirizzo ?? '').trim();
}
