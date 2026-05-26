import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { DEFAULT_DETTAGLI_PER_TIPO_LUOGO } from '../data/defaultLuoghiImpostazioni';
import { resolvePmaClinicaFarmaciFields } from '../pma/lib/pmaClinicaFarmaciFields';
import { normalizeTipiMezzo } from './tipiMezzo';

/** Unifica dati Firestore con default e migra dettagliEvento → dettagliPerTipoEvento. */
export function normalizeImpostazioni(data) {
  const merged = { ...DEFAULT_IMPOSTAZIONI, ...(data ?? {}) };
  let dettagliPerTipo = merged.dettagliPerTipoEvento;

  if (
    (!dettagliPerTipo || typeof dettagliPerTipo !== 'object' || Object.keys(dettagliPerTipo).length === 0) &&
    Array.isArray(merged.dettagliEvento) &&
    merged.dettagliEvento.length > 0
  ) {
    dettagliPerTipo = Object.fromEntries(
      (merged.tipiEvento ?? []).map((tipo) => [tipo, [...merged.dettagliEvento]]),
    );
  }

  if (!dettagliPerTipo || typeof dettagliPerTipo !== 'object') {
    dettagliPerTipo = {};
  }

  let dettagliPerTipoLuogo = merged.dettagliPerTipoLuogo;
  if (!dettagliPerTipoLuogo || typeof dettagliPerTipoLuogo !== 'object') {
    dettagliPerTipoLuogo = {};
  }
  const tipiLuogo =
    Array.isArray(merged.tipiLuogo) && merged.tipiLuogo.length > 0
      ? merged.tipiLuogo
      : [...DEFAULT_IMPOSTAZIONI.tipiLuogo];
  if (Object.keys(dettagliPerTipoLuogo).length === 0) {
    dettagliPerTipoLuogo = { ...DEFAULT_DETTAGLI_PER_TIPO_LUOGO };
  }

  let mappaDashboardDefault = merged.mappaDashboardDefault;
  if (mappaDashboardDefault != null && typeof mappaDashboardDefault === 'object') {
    const lat = Number(mappaDashboardDefault.lat);
    const lng = Number(mappaDashboardDefault.lng);
    const zoom = Number(mappaDashboardDefault.zoom);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      mappaDashboardDefault = {
        luogo:
          typeof mappaDashboardDefault.luogo === 'string' ? mappaDashboardDefault.luogo : '',
        lat,
        lng,
        zoom: Number.isFinite(zoom) ? Math.min(20, Math.max(2, Math.round(zoom))) : 14,
      };
    } else {
      mappaDashboardDefault = null;
    }
  } else {
    mappaDashboardDefault = null;
  }

  const defaultPma = DEFAULT_IMPOSTAZIONI.pmaClinica ?? {};
  const rawPma = merged.pmaClinica && typeof merged.pmaClinica === 'object' ? merged.pmaClinica : {};
  const pmaClinicaMerged = {
    ...defaultPma,
    ...rawPma,
    dettaglio_eo_rapido: {
      ...(defaultPma.dettaglio_eo_rapido ?? {}),
      ...(rawPma.dettaglio_eo_rapido ?? {}),
    },
  };
  const { farmaci, farmaci_consumati } = resolvePmaClinicaFarmaciFields(pmaClinicaMerged);
  const pmaClinica = {
    ...pmaClinicaMerged,
    farmaci,
    farmaci_consumati,
  };

  return {
    ...merged,
    dettagliPerTipoEvento: dettagliPerTipo,
    tipiLuogo,
    dettagliPerTipoLuogo,
    mappaDashboardDefault,
    tipiMezzo: normalizeTipiMezzo(merged.tipiMezzo),
    pmaClinica,
  };
}

export function dettagliPerTipoEvento(impostazioni, tipoEvento) {
  const map = impostazioni?.dettagliPerTipoEvento ?? {};
  if (!tipoEvento) return [];
  return map[tipoEvento] ?? [];
}

export function dettagliPerTipoLuogo(impostazioni, luogo) {
  const map = impostazioni?.dettagliPerTipoLuogo ?? {};
  if (!luogo) return [];
  return map[luogo] ?? [];
}
