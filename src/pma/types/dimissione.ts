/**
 * Sezione 4 — Esito dimissione (valori persistiti su Firestore).
 * Etichette UI in `DIMISSIONE_ESITO_LABEL`.
 */
export const DIMISSIONE_ESITO_VALUES = [
  'dimissione',
  'rinvio_mmg',
  'invio_ps',
  'rifiuta_invio_ps',
  'si_allontana',
  'riaffidato',
  'altro',
] as const

export type DimissioneEsito = (typeof DIMISSIONE_ESITO_VALUES)[number]

export const DIMISSIONE_ESITO_LABEL: Record<DimissioneEsito, string> = {
  dimissione: 'Dimissione',
  rinvio_mmg: 'Rinvio a MMG',
  invio_ps: 'Invio in PS',
  rifiuta_invio_ps: 'Rifiuta invio in PS',
  si_allontana: 'Si allontana',
  riaffidato: 'Riaffidato a',
  altro: 'Altro',
}

export function isDimissioneEsito(v: unknown): v is DimissioneEsito {
  return typeof v === 'string' && (DIMISSIONE_ESITO_VALUES as readonly string[]).includes(v)
}
