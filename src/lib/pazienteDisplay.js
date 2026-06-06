/** Cognome nome per UI (fallback «Senza nome»). */
export function pazienteNomeDisplay(paziente) {
  return [paziente?.cognome, paziente?.nome].filter(Boolean).join(' ') || 'Senza nome';
}

/** Numero pettorale se valorizzato, altrimenti null. */
export function pazientePettoraleDisplay(paziente) {
  const pett = paziente?.pettorale;
  if (pett == null || pett === '') return null;
  return pett;
}
