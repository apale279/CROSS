/** Valori impostabili manualmente dall’operatore (scheda mezzo / pagina mezzi). */
export const MEZZO_STATO_DISPONIBILE = 'Disponibile';
export const MEZZO_STATO_NON_DISPONIBILE = 'Non disponibile';

export const MEZZO_STATI_MANUALI = [
  MEZZO_STATO_DISPONIBILE,
  MEZZO_STATO_NON_DISPONIBILE,
];

/** Opzioni per `<select>`; include lo stato corrente se impostato da missione (es. avaria). */
export function mezzoStatoSelectOptions(statoCorrente) {
  const opts = MEZZO_STATI_MANUALI.map((value) => ({ value, label: value }));
  if (statoCorrente && !MEZZO_STATI_MANUALI.includes(statoCorrente)) {
    opts.push({ value: statoCorrente, label: statoCorrente });
  }
  return opts;
}

/** Ordine tabella Stato mezzi: sigla, con «Non disponibile» in fondo. */
export function compareMezziDashboardSort(a, b) {
  const statoA = a?.statoMezzo ?? MEZZO_STATO_DISPONIBILE;
  const statoB = b?.statoMezzo ?? MEZZO_STATO_DISPONIBILE;
  const tailA = statoA === MEZZO_STATO_NON_DISPONIBILE ? 1 : 0;
  const tailB = statoB === MEZZO_STATO_NON_DISPONIBILE ? 1 : 0;
  if (tailA !== tailB) return tailA - tailB;
  return String(a?.sigla ?? a?._docId ?? '').localeCompare(
    String(b?.sigla ?? b?._docId ?? ''),
    'it',
    { sensitivity: 'base' },
  );
}
