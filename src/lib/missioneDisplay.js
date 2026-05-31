/** Etichetta operativa missione + mezzo (es. M1_BRAVO_1). */
export function formatMissioneMezzoLabel(idMissione, mezzo) {
  const id = String(idMissione ?? '').trim() || '—';
  const sigla = String(mezzo ?? '').trim() || '—';
  return `${id}_${sigla}`;
}
