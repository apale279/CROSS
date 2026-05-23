export const ESITI_MISSIONE = [
  'REGOLARE',
  'NON TRASPORTA',
  'INTERROTTA',
  'DIROTTATO',
  'FLAG DOWN',
  'AVARIA',
  'ALTRO',
];

export const ESITO_MISSIONE_DEFAULT = 'REGOLARE';

export function normalizeEsitoMissione(raw) {
  const v = String(raw ?? '').trim().toUpperCase();
  if (v === 'FLAG_DOWN') return 'FLAG DOWN';
  return ESITI_MISSIONE.includes(v) ? v : ESITO_MISSIONE_DEFAULT;
}
