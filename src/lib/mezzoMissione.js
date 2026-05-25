/** Missione ancora attiva sul mezzo (non terminata / non annullata). */
export function isMissioneAttiva(missione) {
  if (!missione || missione.aperta === false) return false;
  const s = missione.stato ?? '';
  return s !== 'FINE MISSIONE' && s !== 'ANNULLATA';
}

/** Il mezzo è impegnato da questa missione (RIENTRO / ARRIVATO H = mezzo libero per nuovo ingaggio). */
export function missioneBloccaMezzo(missione) {
  if (!isMissioneAttiva(missione)) return false;
  const s = missione.stato ?? '';
  if (s === 'RIENTRO' || s === 'ARRIVATO H') return false;
  return true;
}

/** Allinea sigle tipo BRAVO_1 / BRAVO1 (come in telegram mezzoResolve). */
export function normalizeMezzoKey(sigla) {
  return String(sigla ?? '')
    .replace(/_/g, '')
    .toLowerCase();
}

export function mezzoHaMissioneAttiva(sigla, missioni) {
  if (!sigla) return false;
  const nk = normalizeMezzoKey(sigla);
  return (missioni ?? []).some(
    (m) => missioneBloccaMezzo(m) && m.mezzo && normalizeMezzoKey(m.mezzo) === nk,
  );
}

export function mezziConMissioneAttiva(missioni) {
  const set = new Set();
  for (const m of missioni ?? []) {
    if (missioneBloccaMezzo(m) && m.mezzo) {
      set.add(m.mezzo);
      set.add(normalizeMezzoKey(m.mezzo));
    }
  }
  return set;
}

export function siglaInMezziMissione(sigla, mezziConMissione) {
  const s = String(sigla ?? '').trim();
  if (!s || !mezziConMissione) return false;
  if (mezziConMissione.has(s)) return true;
  return mezziConMissione.has(normalizeMezzoKey(s));
}

export function mezzoIsOnMissioneAttiva(mezzo, mezziConMissione) {
  const sigla = String(mezzo?.sigla ?? mezzo?._docId ?? '').trim();
  if (!sigla) return false;
  if (siglaInMezziMissione(sigla, mezziConMissione)) return true;
  const docId = String(mezzo?._docId ?? '').trim();
  return Boolean(docId && siglaInMezziMissione(docId, mezziConMissione));
}

/** Missioni ancora aperte sulla stessa sigla mezzo. */
export function missioniAperteSuMezzo(missioni, mezzoSigla) {
  const nk = normalizeMezzoKey(mezzoSigla);
  if (!nk) return [];
  return (missioni ?? []).filter(
    (m) => isMissioneAttiva(m) && m.mezzo && normalizeMezzoKey(m.mezzo) === nk,
  );
}

/** Stati in cui il mezzo è selezionabile per nuovo ingaggio (missione precedente resta aperta/visibile). */
export function isStatoMissioneRientroOLiberato(stato) {
  const s = String(stato ?? '').trim();
  return s === 'RIENTRO' || s === 'ARRIVATO H';
}

/** Missioni aperte sul mezzo in rientro/liberate (da chiudere con FINE MISSIONE al nuovo ingaggio). */
export function missioniRientroAperteSuMezzo(missioni, mezzoSigla) {
  return missioniAperteSuMezzo(missioni, mezzoSigla).filter((m) =>
    isStatoMissioneRientroOLiberato(m.stato),
  );
}
