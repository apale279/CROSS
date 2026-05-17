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
