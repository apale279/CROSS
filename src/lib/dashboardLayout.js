export const DASHBOARD_LAYOUT_KEY = 'cross-dashboard-layout';

const MAPPA_W = 1 / 3;
const PMA_W = 1 / 6;

export const DEFAULT_DASHBOARD_LAYOUT = {
  operativo: { x: 0, y: 0, w: 1, h: 0.5 },
  mezzi: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
  mappa: { x: 0.5, y: 0.5, w: MAPPA_W, h: 0.5 },
  pma: { x: 0.5 + MAPPA_W, y: 0.5, w: PMA_W, h: 0.5 },
};

/** Aggiunge pannello PMA e riduce mappa se il layout è precedente alla split mappa/PMA. */
function ensurePmaPanelLayout(layout) {
  const next = { ...DEFAULT_DASHBOARD_LAYOUT, ...layout };
  if (next.pma) return next;
  const m = layout?.mappa ?? DEFAULT_DASHBOARD_LAYOUT.mappa;
  return {
    ...next,
    mappa: { x: m.x ?? 0.5, y: m.y ?? 0.5, w: MAPPA_W, h: m.h ?? 0.5 },
    pma: { x: 0.5 + MAPPA_W, y: m.y ?? 0.5, w: PMA_W, h: m.h ?? 0.5 },
  };
}

/** Migra layout salvati con pannelli separati eventi/missioni. */
function migrateDashboardLayout(parsed) {
  if (parsed?.operativo) {
    return ensurePmaPanelLayout(parsed);
  }
  const e = parsed?.eventi ?? { x: 0, y: 0, w: 0.5, h: 0.5 };
  const m = parsed?.missioni ?? { x: 0.5, y: 0, w: 0.5, h: 0.5 };
  if (e || m) {
    const x1 = e?.x ?? 0;
    const y1 = e?.y ?? 0;
    const x2 = (m?.x ?? 0) + (m?.w ?? 0.5);
    const y2 = (m?.y ?? 0) + (m?.h ?? 0.5);
    const legacy = {
      operativo: {
        x: Math.min(x1, m?.x ?? 0),
        y: Math.min(y1, m?.y ?? 0),
        w: Math.max((e?.x ?? 0) + (e?.w ?? 0.5), x2) - Math.min(x1, m?.x ?? 0),
        h: Math.max((e?.y ?? 0) + (e?.h ?? 0.5), y2) - Math.min(y1, m?.y ?? 0),
      },
      mezzi: parsed?.mezzi ?? DEFAULT_DASHBOARD_LAYOUT.mezzi,
      mappa: parsed?.mappa ?? DEFAULT_DASHBOARD_LAYOUT.mappa,
    };
    return ensurePmaPanelLayout(legacy);
  }
  return ensurePmaPanelLayout(parsed ?? {});
}

export function loadDashboardLayout(manifestationId) {
  try {
    const raw = localStorage.getItem(`${DASHBOARD_LAYOUT_KEY}-${manifestationId}`);
    if (!raw) return { ...DEFAULT_DASHBOARD_LAYOUT };
    return migrateDashboardLayout(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_DASHBOARD_LAYOUT };
  }
}

export function saveDashboardLayout(manifestationId, layout) {
  localStorage.setItem(`${DASHBOARD_LAYOUT_KEY}-${manifestationId}`, JSON.stringify(layout));
}

export function resetDashboardLayout(manifestationId) {
  localStorage.removeItem(`${DASHBOARD_LAYOUT_KEY}-${manifestationId}`);
  window.dispatchEvent(new CustomEvent('dashboard-layout-reset'));
}
