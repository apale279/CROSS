export function nextStatoMissione(current, statiMissione) {
  if (!statiMissione?.length) return current;
  if (current === 'FINE MISSIONE' || current === 'ANNULLATA') return current;
  const seq = statiMissione.filter((s) => s !== 'ANNULLATA');
  const idx = seq.indexOf(current);
  if (idx < 0) return current;
  if (idx >= seq.length - 1) return seq[idx];
  return seq[idx + 1];
}

/** Stati intermedi (incluso target) da current a target nella sequenza operativa. */
export function statiPercorsiAvanzamento(current, target, statiMissione) {
  const from = String(current ?? '').trim();
  const to = String(target ?? '').trim();
  if (!to || from === to) return [];
  const seq = (statiMissione ?? []).filter((s) => s !== 'ANNULLATA');
  const i0 = seq.indexOf(from);
  const i1 = seq.indexOf(to);
  if (i0 < 0 || i1 < 0 || i1 <= i0) return [to];
  return seq.slice(i0 + 1, i1 + 1);
}
