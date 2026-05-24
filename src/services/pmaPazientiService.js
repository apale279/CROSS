import { Timestamp } from 'firebase/firestore';
import { STATO_PAZIENTE_PMA } from '../constants';
import { STATO_PZ_PMA, TIPO_PZ, normalizeStatoPzPma } from '../lib/pmaModule';
import { createPaziente } from './pazientiService';

/** Paziente creato al PMA (autopresentato alla tenda). */
export async function createPazientePmaAutopresentato(
  manifestationId,
  pmaId,
  pmaNome,
  payload,
  existingPazienti,
) {
  const { pmaSchedaSeed, statoPzPma: statoRaw, ...patientPayload } = payload;

  const statoNorm = normalizeStatoPzPma(statoRaw);
  const statoPzPma =
    statoNorm === STATO_PZ_PMA.IN_CARICO ? STATO_PZ_PMA.IN_CARICO : STATO_PZ_PMA.IN_ATTESA;

  const seed = { ...(pmaSchedaSeed && typeof pmaSchedaSeed === 'object' ? pmaSchedaSeed : {}) };
  if (statoPzPma === STATO_PZ_PMA.IN_CARICO && !seed.ingresso_carico_at) {
    seed.ingresso_carico_at = Timestamp.now();
  }

  const result = await createPaziente(
    manifestationId,
    {
      ...patientPayload,
      eventoIdUnivoco: '',
      eventoCorrelato: '',
      esito: '',
      esitoAltro: '',
      mezzo: '',
      ospedaleDestinazione: pmaNome ?? '',
      destinazionePmaId: pmaId,
      pmaId,
      tipoPz: TIPO_PZ.PMA,
      statoPzPma,
      stato: STATO_PAZIENTE_PMA,
      aperta: true,
      pmaSchedaSeed: seed,
    },
    existingPazienti,
  );

  return result;
}
