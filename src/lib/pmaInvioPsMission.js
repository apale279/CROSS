/** Missione/evento creati da «CREA TRASPORTO» (PMA dimissione → PS), senza paziente collegato. */
export const TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS = 'PMA_INVIO_PS';

export function isMissionePmaInvioPs(missione) {
  return missione?.tipoTrasporto === TIPO_TRASPORTO_MISSIONE_PMA_INVIO_PS;
}

/** Paziente dimesso: non deve mai essere riallineato da sync missione centrale. */
export function pazienteEsclusoDaSyncMissione(paziente) {
  if (!paziente) return true;
  const statoPma = String(paziente.statoPzPma ?? '').trim().toUpperCase();
  if (statoPma === 'DIMESSO') return true;
  return false;
}

/** Trasporto PMA→PS già aperto per questo paziente (evita doppio evento/missione). */
export function missionePmaInvioPsApertaPerPaziente(missioni, pazienteDocId) {
  const docId = String(pazienteDocId ?? '').trim();
  if (!docId) return null;
  return (
    (missioni ?? []).find(
      (m) =>
        isMissionePmaInvioPs(m) &&
        m.pazienteRiferimento?.docId === docId &&
        m.aperta !== false &&
        m.stato !== 'FINE MISSIONE' &&
        m.stato !== 'ANNULLATA',
    ) ?? null
  );
}
