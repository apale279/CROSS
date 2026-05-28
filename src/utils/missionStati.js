export function nextStatoMissione(current, statiMissione) {
  if (!statiMissione?.length) return current;
  if (current === 'FINE MISSIONE' || current === 'ANNULLATA') return current;
  const seq = statiMissione.filter((s) => s !== 'ANNULLATA');
  const idx = seq.indexOf(current);
  if (idx < 0) return current;
  if (idx >= seq.length - 1) return seq[idx];
  return seq[idx + 1];
}
