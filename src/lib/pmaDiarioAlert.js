/** Sequenza alert PMA inviato dalla centrale (incrementa a ogni ALLERTA PMA). */
export function diarioPmaAlertSeq(nota) {
  return Number(nota?.pmaAlertSeq ?? 0);
}

/** Ultima sequenza chiusa globalmente da un operatore PMA. */
export function diarioPmaAlertChiusoSeq(nota) {
  return Number(nota?.pmaAlertChiusoSeq ?? 0);
}

/** Nota importante con alert PMA ancora aperto per tutti i desk. */
export function isDiarioNotaPmaAlertAttivo(nota) {
  if (!nota?.importante) return false;
  const seq = diarioPmaAlertSeq(nota);
  const chiuso = diarioPmaAlertChiusoSeq(nota);
  return seq > 0 && seq > chiuso;
}

export function diarioPmaAlertKey(docId, seq) {
  return `diario_pma:${docId}:${seq}`;
}

/** Elenco alert diario attivi, dal più recente. */
export function collectDiarioPmaAlertsAttivi(docs) {
  return (docs ?? [])
    .map((d) => ({ _docId: d.id, ...d.data() }))
    .filter(isDiarioNotaPmaAlertAttivo)
    .sort((a, b) => {
      const ta = a.pmaAlertInviatoIl?.toMillis?.() ?? a.aggiornatoIl?.toMillis?.() ?? 0;
      const tb = b.pmaAlertInviatoIl?.toMillis?.() ?? b.aggiornatoIl?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .map((nota) => ({
      alertKey: diarioPmaAlertKey(nota._docId, diarioPmaAlertSeq(nota)),
      notaDocId: nota._docId,
      titolo: String(nota.titolo ?? '').trim() || 'Nota diario',
      testo: String(nota.testo ?? '').trim(),
      seq: diarioPmaAlertSeq(nota),
    }));
}

export function truncateDiarioAlertTesto(testo, max = 280) {
  const s = String(testo ?? '').trim();
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}
