/** Stati terminali: nessun avanzamento sequenziale. */
export function isStatoMissioneTerminale(stato) {
  return stato === 'FINE MISSIONE' || stato === 'ANNULLATA';
}

/** Unica chiusura missione consentita all'equipaggio da Telegram. */
export function isStatoChiusuraMissioneEquipaggio(stato) {
  return stato === 'FINE MISSIONE';
}

/** Equipaggio Telegram: annullamento solo centrale; chiusura solo con FINE MISSIONE. */
export function canEquipaggioAvanzareStatoDaTelegram(nuovo) {
  const s = String(nuovo ?? '').trim();
  if (!s || s === 'ANNULLATA') return false;
  if (isStatoMissioneTerminale(s) && !isStatoChiusuraMissioneEquipaggio(s)) return false;
  return true;
}

export function isMissioneModificabileSuTelegram(missione) {
  if (!missione) return false;
  if (missione.aperta === false) return false;
  if (isStatoMissioneTerminale(missione.stato)) return false;
  return true;
}

export function shouldOfferTelegramStatoAdvanceButton({ stato, next, aperta = true }) {
  if (!isMissioneModificabileSuTelegram({ stato, aperta })) return false;
  if (!next || next === stato) return false;
  return canEquipaggioAvanzareStatoDaTelegram(next);
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
