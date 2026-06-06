import { useMemo } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { defaultEoLabelForColumn } from '@pma/lib/eoQuickSelection';
import { structuredEoQuickGroupRows } from '@pma/lib/eoStructuredDefaults';
import { parsePresetFarmaciFromFirestore } from '@pma/types/manifestazioneImpostazioni';
import { parseFarmaciCatalogoFromFirestore } from '@pma/types/farmaciCatalogo';
import { sortStringsIt } from '@pma/lib/sortLocaleIt';

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/** Liste EO da modello strutturato (Excel importato in codice), non da impostazioni. */
function buildEoQuickGroups() {
  return structuredEoQuickGroupRows();
}

/** Liste cliniche: prestazioni/farmaci da Firestore; EO rapido da codice. */
export function usePmaClinicaListe() {
  const { impostazioni, loading } = useImpostazioni();
  const pmaClinica = (impostazioni?.pmaClinica ?? {}) as Record<string, unknown>;

  return useMemo(() => {
    const prestazioni = sortStringsIt(asStringArray(pmaClinica.prestazioni) ?? []);
    /** Solo elenco farmaci selezionabili (Impostazioni → PMA clinica → Farmaci), mai consumati. */
    const farmaciCatalogo = parseFarmaciCatalogoFromFirestore(pmaClinica.farmaci);
    const farmaci = sortStringsIt(farmaciCatalogo.map((f) => f.nome));
    const eoQuickGroups = buildEoQuickGroups();
    const eoQuickLabels = eoQuickGroups.flatMap((g) => g.labels);
    const eoQuickDefaultLabel =
      defaultEoLabelForColumn(eoQuickGroups.find((g) => g.title === 'GENERALE')?.labels ?? []) ||
      'NELLA NORMA';
    const presetFarmaci = parsePresetFarmaciFromFirestore(pmaClinica.preset_farmaci);

    return {
      prestazioni,
      farmaci,
      farmaciCatalogo,
      tipoEventoList: [],
      dettaglioEventoPerTipo: {},
      eoQuickLabels,
      eoQuickGroups,
      eoQuickDefaultLabel,
      loading,
      presetFarmaci,
      consensoGenericoCure: String(pmaClinica.consenso_generico_cure ?? ''),
      consensoPrivacy: String(pmaClinica.consenso_privacy ?? ''),
      rifiutoInvioPs: String(pmaClinica.rifiuto_invio_ps ?? ''),
      presetDimissione: Array.isArray(pmaClinica.preset_dimissione)
        ? pmaClinica.preset_dimissione
        : [],
    };
  }, [pmaClinica, loading]);
}

/** Alias per componenti portati da PMApp. */
export function useManifestazioneListeCliniche(_manifestazioneId?: string) {
  return usePmaClinicaListe();
}
