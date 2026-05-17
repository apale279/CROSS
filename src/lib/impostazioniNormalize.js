import { DEFAULT_IMPOSTAZIONI } from '../constants';
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

  return {
    ...merged,
    dettagliPerTipoEvento: dettagliPerTipo,
    mappaDashboardDefault,
    tipiMezzo: normalizeTipiMezzo(merged.tipiMezzo),
  };
}

export function dettagliPerTipoEvento(impostazioni, tipoEvento) {
  const map = impostazioni?.dettagliPerTipoEvento ?? {};
  if (!tipoEvento) return [];
  return map[tipoEvento] ?? [];
}
