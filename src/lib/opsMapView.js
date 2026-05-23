export const OPS_MAP_VIEW_STORAGE_KEY = 'cross.opsMap.viewMode';

/** Vista completa (comportamento Google Maps predefinito). */
export const OPS_MAP_VIEW_STANDARD = 'standard';

/** Planimetria stradale senza POI e trasporto pubblico. */
export const OPS_MAP_VIEW_STREET = 'street';

/** Vista satellite con etichette stradali. */
export const OPS_MAP_VIEW_SATELLITE = 'satellite';

export const OPS_MAP_STREET_ONLY_STYLES = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

const VALID_MODES = new Set([
  OPS_MAP_VIEW_STANDARD,
  OPS_MAP_VIEW_STREET,
  OPS_MAP_VIEW_SATELLITE,
]);

export function readOpsMapViewMode() {
  try {
    const v = sessionStorage.getItem(OPS_MAP_VIEW_STORAGE_KEY);
    if (VALID_MODES.has(v)) return v;
  } catch {
    /* ignore */
  }
  return OPS_MAP_VIEW_STANDARD;
}

export function persistOpsMapViewMode(mode) {
  try {
    sessionStorage.setItem(OPS_MAP_VIEW_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function opsMapOptionsForView(baseOptions, viewMode) {
  if (viewMode === OPS_MAP_VIEW_SATELLITE) {
    return {
      ...baseOptions,
      mapTypeId: 'hybrid',
      styles: undefined,
    };
  }
  if (viewMode === OPS_MAP_VIEW_STREET) {
    return {
      ...baseOptions,
      mapTypeId: 'roadmap',
      styles: OPS_MAP_STREET_ONLY_STYLES,
    };
  }
  return {
    ...baseOptions,
    mapTypeId: 'roadmap',
    styles: undefined,
  };
}
