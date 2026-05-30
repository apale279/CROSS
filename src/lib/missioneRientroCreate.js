/** Codice errore: mezzo con missione aperta in RIENTRO / ARRIVATO H. */
export const MEZZO_RIENTRO_APERTO = 'MEZZO_RIENTRO_APERTO';

export class MezzoRientroMissioneApertaError extends Error {
  /** @param {string} mezzoSigla @param {object} missione */
  constructor(mezzoSigla, missione) {
    const stato = missione?.stato ?? 'RIENTRO';
    const idMis = missione?.idMissione ?? '—';
    super(
      `Il mezzo ${mezzoSigla} è in «${stato}» sulla missione ${idMis}. ` +
        'Conferma la chiusura della missione precedente per un nuovo ingaggio.',
    );
    this.name = 'MezzoRientroMissioneApertaError';
    this.code = MEZZO_RIENTRO_APERTO;
    this.mezzoSigla = mezzoSigla;
    this.missione = missione;
  }
}

export function isMezzoRientroApertaError(err) {
  return err?.code === MEZZO_RIENTRO_APERTO;
}

/**
 * Crea missione; se il mezzo è in RIENTRO chiude automaticamente la precedente.
 * @returns {Promise<object|null>} Risultato createMissione
 */
export async function createMissioneConConfermaRientro(
  createMissioneFn,
  manifestationId,
  payload,
  existingMissioni,
  mezzo,
  existingPazienti = [],
) {
  return createMissioneFn(
    manifestationId,
    payload,
    existingMissioni,
    mezzo,
    existingPazienti,
  );
}
