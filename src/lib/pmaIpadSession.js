/** URL apertura vista iPad firma per un PMA (scan QR). */
export function buildPmaIpadPairingUrl(pmaId) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const id = encodeURIComponent(String(pmaId ?? '').trim());
  return `${origin}/pma-ipad/${id}`;
}
