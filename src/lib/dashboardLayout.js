export const DASHBOARD_LAYOUT_KEY = 'cross-dashboard-layout';

export const DEFAULT_DASHBOARD_LAYOUT = {
  eventi: { x: 0, y: 0, w: 0.5, h: 0.5 },
  missioni: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
  mezzi: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
  mappa: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
};

export function loadDashboardLayout(manifestationId) {
  try {
    const raw = localStorage.getItem(`${DASHBOARD_LAYOUT_KEY}-${manifestationId}`);
    if (!raw) return { ...DEFAULT_DASHBOARD_LAYOUT };
    return { ...DEFAULT_DASHBOARD_LAYOUT, ...JSON.parse(raw) };
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
