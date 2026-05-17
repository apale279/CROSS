import { KIOSK_PANEL_IDS } from './kioskPopOut';

const KEY_PREFIX = 'cross-kiosk-panels';

export function loadKioskPanelModes(manifestationId) {
  if (!manifestationId) return null;
  try {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}-${manifestationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const modes = {};
    for (const id of KIOSK_PANEL_IDS) {
      const v = parsed?.modes?.[id];
      if (v === 'embedded' || v === 'popped' || v === 'docked') modes[id] = v;
    }
    return {
      modes: Object.keys(modes).length ? modes : null,
      dockSource: parsed?.dockSource ?? {},
    };
  } catch {
    return null;
  }
}

export function saveKioskPanelModes(manifestationId, modes, dockSource) {
  if (!manifestationId) return;
  try {
    sessionStorage.setItem(
      `${KEY_PREFIX}-${manifestationId}`,
      JSON.stringify({ modes, dockSource }),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearKioskPanelModes(manifestationId) {
  if (!manifestationId) return;
  try {
    sessionStorage.removeItem(`${KEY_PREFIX}-${manifestationId}`);
  } catch {
    /* ignore */
  }
}
