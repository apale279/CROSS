/** Missione ancora attiva sul mezzo (non terminata / non annullata). */
export function isMissioneAttiva(missione) {
  if (!missione || missione.aperta === false) return false;
  const s = missione.stato ?? '';
  return s !== 'FINE MISSIONE' && s !== 'ANNULLATA';
}

export function mezzoHaMissioneAttiva(sigla, missioni) {
  if (!sigla) return false;
  return (missioni ?? []).some((m) => m.mezzo === sigla && isMissioneAttiva(m));
}

export function mezziConMissioneAttiva(missioni) {
  const set = new Set();
  for (const m of missioni ?? []) {
    if (isMissioneAttiva(m) && m.mezzo) set.add(m.mezzo);
  }
  return set;
}

export function mezzoIsOnMissioneAttiva(mezzo, mezziConMissione) {
  const sigla = String(mezzo?.sigla ?? mezzo?._docId ?? '').trim();
  if (!sigla) return false;
  if (mezziConMissione.has(sigla)) return true;
  const docId = String(mezzo?._docId ?? '').trim();
  return Boolean(docId && mezziConMissione.has(docId));
}
