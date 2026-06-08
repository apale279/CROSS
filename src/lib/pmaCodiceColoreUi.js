/** Classi bordo/card per codice colore triage (allineate al pallino dashboard PMA). */
export const PMA_CODICE_COLORE_BORDER = {
  bianco: 'border-slate-300',
  verde: 'border-emerald-500',
  giallo: 'border-amber-400',
  rosso: 'border-red-500',
};

export const PMA_CODICE_COLORE_BG = {
  bianco: 'bg-slate-50',
  verde: 'bg-emerald-50/40',
  giallo: 'bg-amber-50/40',
  rosso: 'bg-red-50/40',
};

/** Codice colore da documento CROSS o vista scheda PMA. */
export function codiceColorePazientePma(paziente) {
  return paziente?.pmaScheda?.codice_colore ?? paziente?.codice_colore ?? 'verde';
}

export function pmaCodiceColoreBorderClass(codiceColore) {
  const c = codiceColore ?? 'verde';
  return PMA_CODICE_COLORE_BORDER[c] ?? PMA_CODICE_COLORE_BORDER.verde;
}

export function pmaCodiceColoreCardClass(paziente) {
  if (!paziente) return `${PMA_CODICE_COLORE_BORDER.verde} ${PMA_CODICE_COLORE_BG.verde}`;
  const c = codiceColorePazientePma(paziente);
  return `${pmaCodiceColoreBorderClass(c)} ${PMA_CODICE_COLORE_BG[c] ?? PMA_CODICE_COLORE_BG.verde}`;
}
