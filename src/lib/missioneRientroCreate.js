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

/** Testo dialogo conferma nuovo ingaggio durante rientro. */
export function messaggioConfermaRientro(missione, mezzoSigla) {
  const stato = missione?.stato ?? 'RIENTRO';
  const idMis = missione?.idMissione ?? '—';
  const ev = missione?.eventoCorrelato ?? '—';
  return (
    `Il mezzo ${mezzoSigla} è in «${stato}» sulla missione ${idMis} (evento ${ev}): ` +
    'sta rientrando dalla destinazione precedente.\n\n' +
    'La missione in rientro resterà visibile finché non la chiudi manualmente o confermi qui.\n\n' +
    'Terminare quella missione (FINE MISSIONE) e ingaggiare il mezzo su questo evento?'
  );
}

/**
 * Crea missione; se il mezzo è in RIENTRO chiede conferma prima di chiudere la precedente.
 * @returns {Promise<object|null>} Risultato createMissione, o null se l’operatore annulla.
 */
export async function createMissioneConConfermaRientro(
  createMissioneFn,
  manifestationId,
  payload,
  existingMissioni,
  mezzo,
  existingPazienti = [],
  confirmFn = (msg) => window.confirm(msg),
) {
  try {
    return await createMissioneFn(
      manifestationId,
      payload,
      existingMissioni,
      mezzo,
      existingPazienti,
    );
  } catch (err) {
    if (!isMezzoRientroApertaError(err)) throw err;
    if (!confirmFn(messaggioConfermaRientro(err.missione, err.mezzoSigla))) {
      return null;
    }
    return createMissioneFn(
      manifestationId,
      { ...payload, chiudiMissioniRientro: true },
      existingMissioni,
      mezzo,
      existingPazienti,
    );
  }
}
