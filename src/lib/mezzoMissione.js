import {
  MEZZO_STATO_DISPONIBILE,
} from './mezzoStati';

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

export function sameMezzoSigla(a, b) {
  const na = normalizeMezzoKey(a);
  const nb = normalizeMezzoKey(b);
  return Boolean(na && nb && na === nb);
}

/** Trova documento mezzo in lista caricata (sigla o _docId, anche con underscore). */
export function findMezzoBySigla(mezzi, siglaRaw) {
  const key = String(siglaRaw ?? '').trim();
  if (!key) return null;
  const list = mezzi ?? [];
  const exact = list.find((m) => (m.sigla ?? m._docId) === key);
  if (exact) return exact;
  const nk = normalizeMezzoKey(key);
  return (
    list.find((m) => {
      const id = String(m.sigla ?? m._docId ?? '').trim();
      return id && normalizeMezzoKey(id) === nk;
    }) ?? null
  );
}

/** ID documento Firestore per patch (preferisce sigla canonica del mezzo trovato). */
export function resolveMezzoDocIdFromList(mezzi, siglaRaw) {
  const hit = findMezzoBySigla(mezzi, siglaRaw);
  if (hit) return String(hit.sigla ?? hit._docId ?? '').trim();
  return String(siglaRaw ?? '').trim();
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

/** Mezzo selezionabile per nuova missione / trasporto PS. */
export function isMezzoSelezionabilePerNuovaMissione(mezzo, missioni) {
  const sigla = String(mezzo?.sigla ?? mezzo?._docId ?? '').trim();
  if (!sigla) return false;
  if (mezzo?.operativo === false) return false;
  if ((mezzo?.statoMezzo ?? MEZZO_STATO_DISPONIBILE) !== MEZZO_STATO_DISPONIBILE) {
    return false;
  }
  if (mezzoHaMissioneAttiva(sigla, missioni)) return false;
  return true;
}

export function filterMezziSelezionabiliPerNuovaMissione(mezzi, missioni) {
  return (mezzi ?? []).filter((m) => isMezzoSelezionabilePerNuovaMissione(m, missioni));
}
