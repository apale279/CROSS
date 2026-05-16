export const DASHBOARD_LAYOUT_KEY = 'cross-dashboard-layout';

export const DEFAULT_DASHBOARD_LAYOUT = {
  operativo: { x: 0, y: 0, w: 1, h: 0.5 },
  mezzi: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
  mappa: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
};

/** Migra layout salvati con pannelli separati eventi/missioni. */
function migrateDashboardLayout(parsed) {
  if (parsed?.operativo) {
    return { ...DEFAULT_DASHBOARD_LAYOUT, ...parsed };
  }
  const e = parsed?.eventi ?? { x: 0, y: 0, w: 0.5, h: 0.5 };
  const m = parsed?.missioni ?? { x: 0.5, y: 0, w: 0.5, h: 0.5 };
  if (e || m) {
    const x1 = e?.x ?? 0;
    const y1 = e?.y ?? 0;
    const x2 = (m?.x ?? 0) + (m?.w ?? 0.5);
    const y2 = (m?.y ?? 0) + (m?.h ?? 0.5);
    return {
      operativo: {
        x: Math.min(x1, m?.x ?? 0),
        y: Math.min(y1, m?.y ?? 0),
        w: Math.max((e?.x ?? 0) + (e?.w ?? 0.5), x2) - Math.min(x1, m?.x ?? 0),
        h: Math.max((e?.y ?? 0) + (e?.h ?? 0.5), y2) - Math.min(y1, m?.y ?? 0),
      },
      mezzi: parsed?.mezzi ?? DEFAULT_DASHBOARD_LAYOUT.mezzi,
      mappa: parsed?.mappa ?? DEFAULT_DASHBOARD_LAYOUT.mappa,
    };
  }
  return { ...DEFAULT_DASHBOARD_LAYOUT, ...parsed };
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
