import { useMemo } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { EO_CLINICAL_TABS } from '@pma/lib/multilineList';
import { defaultEoQuickGroupRows } from '@pma/lib/eoQuickDefaults';
import { normalizeEoQuickLabels, isNessunaEoOptionLabel } from '@pma/lib/eoQuickSelection';
import { EO_OPZIONI_RAPIDE } from '@pma/types/cartellaClinica';
import {
  PRESTAZIONI_LISTA_DEFAULT,
  FARMACI_LISTA_DEFAULT,
} from '@pma/lib/prestazioniFarmaciDefaults';
import { parsePresetFarmaciFromFirestore } from '@pma/types/manifestazioneImpostazioni';
import { sortStringsIt } from '@pma/lib/sortLocaleIt';

function asStringArray(v) {
  if (!Array.isArray(v)) return null;
  return v.map((x) => String(x ?? '').trim()).filter(Boolean);
}

function buildEoQuickGroups(pmaClinica) {
  const raw = pmaClinica?.dettaglio_eo_rapido;
  const fallback = [...EO_OPZIONI_RAPIDE];
  if (!raw || typeof raw !== 'object') {
    return EO_CLINICAL_TABS.map((title, i) => ({
      title,
      labels: normalizeEoQuickLabels(i === 0 ? fallback : []),
    }));
  }
  return EO_CLINICAL_TABS.map((title) => {
    const arr = asStringArray(raw[title]);
    return { title, labels: normalizeEoQuickLabels(arr?.length ? arr : []) };
  });
}

function flattenLabelsFromGroups(groups) {
  const seen = new Set();
  const flat = [];
  for (const g of groups) {
    for (const x of g.labels) {
      if (!seen.has(x)) {
        seen.add(x);
        flat.push(x);
      }
    }
  }
  return flat.length ? flat : [...EO_OPZIONI_RAPIDE];
}

function eoQuickDefaultFromImpostazioni(pmaClinica, groups) {
  const rawDef = pmaClinica?.dettaglio_eo_rapido_default;
  if (typeof rawDef === 'string' && rawDef.trim() && !isNessunaEoOptionLabel(rawDef.trim())) {
    return rawDef.trim();
  }
  for (const g of groups) {
    if (g.labels.length > 0) return g.labels[0];
  }
  return null;
}

/** Liste cliniche da `impostazioni.pmaClinica` (CROSS). */
export function usePmaClinicaListe() {
  const { impostazioni, loading } = useImpostazioni();
  const pmaClinica = impostazioni?.pmaClinica ?? {};

  return useMemo(() => {
    const prestazioni = sortStringsIt(
      asStringArray(pmaClinica.prestazioni)?.length
        ? asStringArray(pmaClinica.prestazioni)!
        : [...PRESTAZIONI_LISTA_DEFAULT],
    );
    const farmaci = sortStringsIt(
      asStringArray(pmaClinica.farmaci)?.length
        ? asStringArray(pmaClinica.farmaci)!
        : [...FARMACI_LISTA_DEFAULT],
    );
    const eoQuickGroups = buildEoQuickGroups(pmaClinica);
    const eoQuickLabels = flattenLabelsFromGroups(eoQuickGroups);
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
      presetDimissione: Array.isArray(pmaClinica.preset_dimissione) ? pmaClinica.preset_dimissione : [],
    };
  }, [pmaClinica, loading]);
}

/** Alias per componenti portati da PMApp. */
export function useManifestazioneListeCliniche(_manifestazioneId?: string) {
  const liste = usePmaClinicaListe();
  return liste;
}
