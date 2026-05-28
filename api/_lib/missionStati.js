/** Stati terminali: nessun avanzamento sequenziale. */
export function isStatoMissioneTerminale(stato) {
  return stato === 'FINE MISSIONE' || stato === 'ANNULLATA';
}

/**
 * Prossimo stato nella sequenza operativa (esclude ANNULLATA dal flusso «avanti»).
 * Usa sempre lo stato **attuale** su Firestore (anche se la centrale ha saltato passaggi).
 */
export function nextStatoMissione(current, statiMissione) {
  if (!statiMissione?.length) return current;
  if (isStatoMissioneTerminale(current)) return current;
  const seq = statiMissione.filter((s) => s !== 'ANNULLATA');
  const idx = seq.indexOf(current);
  if (idx < 0) return current;
  if (idx >= seq.length - 1) return seq[idx];
  return seq[idx + 1];
}
