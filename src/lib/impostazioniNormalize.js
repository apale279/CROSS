import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { DEFAULT_DETTAGLI_PER_TIPO_LUOGO } from '../data/defaultLuoghiImpostazioni';
import { resolvePmaClinicaFarmaciFields } from '../pma/lib/pmaClinicaFarmaciFields';
import { normalizeTipiMezzo } from './tipiMezzo';
import { normalizeValutazioniMsbMsaImpostazioni } from './valutazioneMsbMsaLists';

/** Unifica dati Firestore con default e migra dettagliEvento → dettagliPerTipoEvento. */
export function normalizeImpostazioni(data) {
  const merged = { ...DEFAULT_IMPOSTAZIONI, ...(data ?? {}) };
  let dettagliPerTipo = merged.dettagliPerTipoEvento;

  if (
    (!dettagliPerTipo || typeof dettagliPerTipo !== 'object' || Object.keys(dettagliPerTipo).length === 0) &&
    Array.isArray(merged.dettagliEvento) &&
    merged.dettagliEvento.length > 0
  ) {
    const tipiPerMigrazione =
      Array.isArray(merged.tipiEvento) && merged.tipiEvento.length > 0
        ? merged.tipiEvento
        : DEFAULT_IMPOSTAZIONI.tipiEvento;
    dettagliPerTipo = Object.fromEntries(
      tipiPerMigrazione.map((tipo) => [tipo, [...merged.dettagliEvento]]),
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
  const chiamantiEvento =
    Array.isArray(merged.chiamantiEvento) && merged.chiamantiEvento.length > 0
      ? merged.chiamantiEvento
      : [...DEFAULT_IMPOSTAZIONI.chiamantiEvento];
  const tipiEventoFiltered = Array.isArray(merged.tipiEvento)
    ? merged.tipiEvento.filter((t) => typeof t === 'string' && String(t).trim())
    : [];
  const tipiEvento =
    tipiEventoFiltered.length > 0 ? tipiEventoFiltered : [...DEFAULT_IMPOSTAZIONI.tipiEvento];
  const statiMissioneFiltered = Array.isArray(merged.statiMissione)
    ? merged.statiMissione.filter((t) => typeof t === 'string' && String(t).trim())
    : [];
  const statiMissione =
    statiMissioneFiltered.length > 0
      ? statiMissioneFiltered
      : [...DEFAULT_IMPOSTAZIONI.statiMissione];
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

  const lesioniCfg = normalizeValutazioniMsbMsaImpostazioni(merged);

  return {
    ...merged,
    dettagliPerTipoEvento: dettagliPerTipo,
    tipiEvento,
    statiMissione,
    tipiLuogo,
    chiamantiEvento,
    dettagliPerTipoLuogo,
    mappaDashboardDefault,
    tipiMezzo: normalizeTipiMezzo(merged.tipiMezzo),
    pmaClinica,
    ...lesioniCfg,
  };
}

export function listaChiamantiEvento(impostazioni) {
  const list = impostazioni?.chiamantiEvento;
  if (Array.isArray(list) && list.length > 0) return list;
  return [...DEFAULT_IMPOSTAZIONI.chiamantiEvento];
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
