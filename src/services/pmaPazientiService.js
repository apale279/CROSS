import { ESITO_TRASPORTA } from '../constants';
import { STATO_PZ_PMA, TIPO_PZ } from '../lib/pmaModule';
import { EMPTY_PMA_SCHEDA } from '../pma/lib/pmaSchedaDefaults';
import { createPaziente } from './pazientiService';

/** Paziente creato al PMA (autopresentato alla tenda). */
export async function createPazientePmaAutopresentato(
  manifestationId,
  pmaId,
  pmaNome,
  payload,
  existingPazienti,
) {
  return createPaziente(
    manifestationId,
    {
      ...payload,
      eventoIdUnivoco: '',
      eventoCorrelato: '',
      esito: '',
      esitoAltro: '',
      mezzo: '',
      ospedaleDestinazione: pmaNome ?? '',
      destinazionePmaId: pmaId,
      pmaId,
      tipoPz: TIPO_PZ.PMA,
      statoPzPma: STATO_PZ_PMA.IN_CARICO,
      pmaScheda: { ...EMPTY_PMA_SCHEDA },
      stato: 'ATTESA',
      aperta: true,
    },
    existingPazienti,
  );
}
