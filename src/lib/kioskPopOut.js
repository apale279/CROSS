/** @typedef {'operativo' | 'mezzi' | 'mappa'} KioskPanelId */

/** @typedef {'embedded' | 'popped' | 'docked'} KioskPanelMode */

export const KIOSK_PANEL_IDS = /** @type {const} */ (['operativo', 'mezzi', 'mappa']);

export const KIOSK_PANEL_CONFIG = {
  operativo: {
    url: '/kiosk/eventi',
    label: 'Eventi e missioni',
    shortLabel: 'Ev/Mis',
    windowName: 'cross-kiosk-operativo',
  },
  mezzi: {
    url: '/kiosk/mezzi',
    label: 'Stato mezzi',
    shortLabel: 'Mezzi',
    windowName: 'cross-kiosk-mezzi',
  },
  mappa: {
    url: '/kiosk/mappa',
    label: 'Mappa',
    shortLabel: 'Mappa',
    windowName: 'cross-kiosk-mappa',
  },
};

/** Path kiosk → id pannello dashboard. */
export const KIOSK_PATH_TO_PANEL = {
  '/kiosk/eventi': 'operativo',
  '/kiosk/mezzi': 'mezzi',
  '/kiosk/mappa': 'mappa',
};

export function appendReadonlyMode(targetUrl) {
  const separator = targetUrl.includes('?') ? '&' : '?';
  return `${targetUrl}${separator}mode=readonly`;
}

export function buildKioskPopOutUrl(path) {
  const absolute =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  return appendReadonlyMode(absolute);
}

export const KIOSK_DOCK_MESSAGE = 'cross-kiosk-dock';

/** Finestra pop-out chiusa → dashboard ripristina il pannello. */
export const KIOSK_WINDOW_CLOSED_MESSAGE = 'cross-kiosk-window-closed';
