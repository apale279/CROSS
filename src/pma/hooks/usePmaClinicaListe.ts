import { useMemo } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { EO_CLINICAL_TABS } from '@pma/lib/multilineList';
import { defaultEoLabelForColumn, normalizeEoQuickLabels, isNessunaEoOptionLabel } from '@pma/lib/eoQuickSelection';
import { parsePresetFarmaciFromFirestore } from '@pma/types/manifestazioneImpostazioni';
import { sortStringsIt } from '@pma/lib/sortLocaleIt';

function asStringArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x ?? '').trim()).filter(Boolean);
}

/** Solo dati Firestore: nessun fallback da costanti in memoria. */
function buildEoQuickGroups(pmaClinica: Record<string, unknown> | null | undefined) {
  const raw = pmaClinica?.dettaglio_eo_rapido;
  if (!raw || typeof raw !== 'object') {
    return EO_CLINICAL_TABS.map((title) => ({ title, labels: [] as readonly string[] }));
  }
  return EO_CLINICAL_TABS.map((title) => {
    const arr = asStringArray((raw as Record<string, unknown>)[title]);
    return { title, labels: normalizeEoQuickLabels(arr ?? []) };
  });
}

function eoQuickDefaultFromImpostazioni(
  pmaClinica: Record<string, unknown> | null | undefined,
  groups: { title: string; labels: readonly string[] }[],
) {
  const rawDef = pmaClinica?.dettaglio_eo_rapido_default;
  if (typeof rawDef === 'string' && rawDef.trim() && !isNessunaEoOptionLabel(rawDef.trim())) {
    return rawDef.trim();
  }
  for (const g of groups) {
    const d = defaultEoLabelForColumn(g.labels);
    if (d) return d;
  }
  return null;
}

/** Liste cliniche da `impostazioni.pmaClinica` (Firestore). */
export function usePmaClinicaListe() {
  const { impostazioni, loading } = useImpostazioni();
  const pmaClinica = (impostazioni?.pmaClinica ?? {}) as Record<string, unknown>;

  return useMemo(() => {
    const prestazioni = sortStringsIt(asStringArray(pmaClinica.prestazioni) ?? []);
    const farmaci = sortStringsIt(asStringArray(pmaClinica.farmaci) ?? []);
    const eoQuickGroups = buildEoQuickGroups(pmaClinica);
    const eoQuickLabels = eoQuickGroups.flatMap((g) => g.labels);
    const eoQuickDefaultLabel = eoQuickDefaultFromImpostazioni(pmaClinica, eoQuickGroups);
    const presetFarmaci = parsePresetFarmaciFromFirestore(pmaClinica.preset_farmaci);

    return {
      prestazioni,
      farmaci,
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
