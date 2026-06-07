/** Stati avanzamento visita PMA (cartella clinica + badge dashboard). */
export const AVANZAMENTO_PMA = {
  DA_VEDERE: 'da_vedere',
  IN_VISITA: 'in_visita',
  ATTESA_DIMISSIONE: 'attesa_dimissione',
};

export const AVANZAMENTO_PMA_LABEL = {
  [AVANZAMENTO_PMA.DA_VEDERE]: 'DA VEDERE',
  [AVANZAMENTO_PMA.IN_VISITA]: 'IN VISITA',
  [AVANZAMENTO_PMA.ATTESA_DIMISSIONE]: 'ATTESA DIMISSIONE',
};

const VALID = new Set(Object.values(AVANZAMENTO_PMA));

export function isAvanzamentoPma(v) {
  return VALID.has(v);
}

function allergieVerificaRisposta(paziente) {
  const v = paziente?.pmaScheda?.allergie_verifica ?? paziente?.allergie_verifica;
  return v === 'si' || v === 'no' || v === 'non_noto';
}

/**
 * Avanzamento effettivo: manuale se impostato, altrimenti da domanda allergie.
 * - DA VEDERE: allergie non verificate
 * - IN VISITA: allergie verificate
 * - ATTESA DIMISSIONE: solo impostazione manuale
 */
export function resolveAvanzamentoPma(paziente) {
  try {
    if (!paziente || typeof paziente !== 'object') return AVANZAMENTO_PMA.DA_VEDERE;
    const manual = paziente?.pmaScheda?.avanzamento_manuale ?? paziente?.avanzamento_manuale;
    if (manual && isAvanzamentoPma(manual)) return manual;
    if (!allergieVerificaRisposta(paziente)) return AVANZAMENTO_PMA.DA_VEDERE;
    return AVANZAMENTO_PMA.IN_VISITA;
  } catch {
    return AVANZAMENTO_PMA.DA_VEDERE;
  }
}

export function avanzamentoPmaLabel(paziente) {
  const stato = resolveAvanzamentoPma(paziente);
  return AVANZAMENTO_PMA_LABEL[stato] ?? AVANZAMENTO_PMA_LABEL[AVANZAMENTO_PMA.DA_VEDERE];
}

/** Badge tailwind per dashboard PMA. */
export function avanzamentoPmaBadgeClass(stato) {
  switch (stato) {
    case AVANZAMENTO_PMA.IN_VISITA:
      return 'bg-sky-100 text-sky-950';
    case AVANZAMENTO_PMA.ATTESA_DIMISSIONE:
      return 'bg-violet-100 text-violet-950';
    default:
      return 'bg-orange-100 text-orange-950';
  }
}
