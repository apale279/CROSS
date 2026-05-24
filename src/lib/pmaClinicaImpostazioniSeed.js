import { EO_CLINICAL_TABS } from '../pma/lib/multilineList';
import { defaultEoLabelForColumn, normalizeEoQuickLabels } from '../pma/lib/eoQuickSelection';
import { PRESTAZIONI_LISTA_DEFAULT, FARMACI_LISTA_DEFAULT } from '../pma/lib/prestazioniFarmaciDefaults';

/** Liste EO iniziali per impostazioni PMA (persistite su Firestore, non solo in memoria). */
export function seedDettaglioEoRapido() {
  const dettaglio_eo_rapido = Object.fromEntries(
    EO_CLINICAL_TABS.map((tab) => [
      tab,
      normalizeEoQuickLabels(
        tab === 'GENERALE' ? ['NELLA NORMA', 'Alterato', 'Non valutabile'] : ['NELLA NORMA'],
      ),
    ]),
  );
  const firstTabLabels = dettaglio_eo_rapido.GENERALE ?? [];
  return {
    dettaglio_eo_rapido,
    dettaglio_eo_rapido_default: defaultEoLabelForColumn(firstTabLabels),
  };
}

/** Valori iniziali `pmaClinica` da scrivere su `manifestazioni/{id}/settings/impostazioni`. */
export function seedPmaClinicaImpostazioni() {
  const eo = seedDettaglioEoRapido();
  return {
    prestazioni: [...PRESTAZIONI_LISTA_DEFAULT],
    farmaci: [...FARMACI_LISTA_DEFAULT],
    ...eo,
    preset_dimissione: [],
    preset_farmaci: [],
    consenso_generico_cure: '',
    consenso_privacy: '',
    rifiuto_invio_ps: '',
  };
}
