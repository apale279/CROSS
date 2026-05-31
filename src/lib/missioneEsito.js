export const ESITI_MISSIONE = [
  'REGOLARE',
  'NON TRASPORTA',
  'INTERROTTA',
  'DIROTTATO',
  'FLAG DOWN',
  'AVARIA',
  'ALTRO',
];

/** Esiti che chiudono la copertura operativa e liberano il mezzo (senza passare da FINE MISSIONE). */
export const ESITI_MISSIONE_TERMINANO_COPERTURA = ['INTERROTTA', 'DIROTTATO'];

export const ESITO_MISSIONE_DEFAULT = 'REGOLARE';

export function normalizeEsitoMissione(raw) {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'FLAG_DOWN') return 'FLAG DOWN';
  if (v === 'DIROTTATA') return 'DIROTTATO';
  return ESITI_MISSIONE.includes(v) ? v : ESITO_MISSIONE_DEFAULT;
}

export function esitoMissioneTerminaCopertura(esito) {
  return ESITI_MISSIONE_TERMINANO_COPERTURA.includes(normalizeEsitoMissione(esito));
}
