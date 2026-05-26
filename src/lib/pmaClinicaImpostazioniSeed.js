import { PRESTAZIONI_LISTA_DEFAULT } from '../pma/lib/prestazioniFarmaciDefaults';
import { defaultFarmaciConsumatiCatalog } from '../pma/lib/farmaciCatalogoSeed';
import { serializeFarmaciCatalogo } from '../pma/types/farmaciCatalogo';

/** Valori iniziali `pmaClinica` da scrivere su `manifestazioni/{id}/settings/impostazioni`. */
export function seedPmaClinicaImpostazioni() {
  return {
    prestazioni: [...PRESTAZIONI_LISTA_DEFAULT],
    farmaci: serializeFarmaciCatalogo(defaultFarmaciConsumatiCatalog()),
    farmaci_consumati: [],
    preset_dimissione: [],
    preset_farmaci: [],
    consenso_generico_cure: '',
    consenso_privacy: '',
    rifiuto_invio_ps: '',
  };
}
