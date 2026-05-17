import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KIOSK_DOCK_MESSAGE,
  KIOSK_WINDOW_CLOSED_MESSAGE,
  KIOSK_PANEL_IDS,
  KIOSK_PANEL_CONFIG,
  buildKioskPopOutUrl,
} from '../lib/kioskPopOut';
import {
  clearKioskPanelModes,
  loadKioskPanelModes,
  saveKioskPanelModes,
} from '../lib/kioskPanelState';

const INITIAL_MODES = () =>
  Object.fromEntries(KIOSK_PANEL_IDS.map((id) => [id, 'embedded']));

const POP_OUT_FEATURES =
  'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';

function loadInitialModes(manifestationId) {
  const saved = loadKioskPanelModes(manifestationId);
  if (!saved?.modes) return INITIAL_MODES();
  return { ...INITIAL_MODES(), ...saved.modes };
}

/**
 * Pop-out monitor esterni + dock icona (stato persistente tra navigazione menu).
 * `popped` = pannello nascosto in dashboard, mostrato in finestra esterna.
 * `docked` = pannello nascosto, icona in barra (finestra esterna chiusa).
 */
export function useKioskPopOut(manifestationId) {
  const savedRef = useRef(loadKioskPanelModes(manifestationId));
  const [panelModes, setPanelModes] = useState(() => loadInitialModes(manifestationId));
  const windowsRef = useRef(/** @type {Record<string, Window | null>} */ ({}));
  const closeWatchRef = useRef(/** @type {Record<string, ReturnType<typeof setInterval>>} */ ({}));
  const dockSourceRef = useRef(savedRef.current?.dockSource ?? {});

  const persist = useCallback(
    (modes, dockSource = dockSourceRef.current) => {
      if (manifestationId) saveKioskPanelModes(manifestationId, modes, dockSource);
    },
    [manifestationId],
  );

  const setModes = useCallback(
    (updater) => {
      setPanelModes((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const clearCloseWatch = useCallback((panelId) => {
    const id = closeWatchRef.current[panelId];
    if (id) clearInterval(id);
    delete closeWatchRef.current[panelId];
  }, []);

  const closeWindow = useCallback((panelId) => {
    clearCloseWatch(panelId);
    const win = windowsRef.current[panelId];
    if (win && !win.closed) {
      try {
        win.close();
      } catch {
        /* ignore */
      }
    }
    windowsRef.current[panelId] = null;
  }, [clearCloseWatch]);

  const watchPopOutClosed = useCallback(
    (panelId, win) => {
      clearCloseWatch(panelId);
      closeWatchRef.current[panelId] = setInterval(() => {
        if (!win.closed) return;
        clearCloseWatch(panelId);
        windowsRef.current[panelId] = null;
        setModes((prev) => {
          if (prev[panelId] !== 'popped') return prev;
          return { ...prev, [panelId]: 'embedded' };
        });
      }, 400);
    },
    [clearCloseWatch, setModes],
  );

  const openExternalWindow = useCallback(
    (panelId) => {
      const cfg = KIOSK_PANEL_CONFIG[panelId];
      if (!cfg) return null;

      const win = window.open(
        buildKioskPopOutUrl(cfg.url),
        cfg.windowName,
        POP_OUT_FEATURES,
      );
      if (!win) return null;

      windowsRef.current[panelId] = win;
      watchPopOutClosed(panelId, win);
      win.focus();
      return win;
    },
    [watchPopOutClosed],
  );

  const dockPanel = useCallback(
    (panelId, source = 'popped') => {
      closeWindow(panelId);
      dockSourceRef.current[panelId] = source;
      setModes((prev) => ({ ...prev, [panelId]: 'docked' }));
    },
    [closeWindow, setModes],
  );

  const popOutPanel = useCallback(
    (panelId) => {
      const cfg = KIOSK_PANEL_CONFIG[panelId];
      if (!cfg) return;

      const existing = windowsRef.current[panelId];
      if (existing && !existing.closed) {
        existing.focus();
        setModes((prev) => ({ ...prev, [panelId]: 'popped' }));
        return;
      }

      const win = openExternalWindow(panelId);
      if (!win) {
        window.alert(
          'Impossibile aprire il monitor esterno. Consenti i popup per questo sito nel browser.',
        );
        return;
      }

      delete dockSourceRef.current[panelId];
      setModes((prev) => ({ ...prev, [panelId]: 'popped' }));
    },
    [openExternalWindow, setModes],
  );

  const restorePanel = useCallback(
    (panelId) => {
      if (dockSourceRef.current[panelId] === 'embedded') {
        setModes((prev) => ({ ...prev, [panelId]: 'embedded' }));
        return;
      }
      popOutPanel(panelId);
    },
    [popOutPanel, setModes],
  );

  const embedPanel = useCallback(
    (panelId) => {
      closeWindow(panelId);
      delete dockSourceRef.current[panelId];
      setModes((prev) => ({ ...prev, [panelId]: 'embedded' }));
    },
    [closeWindow, setModes],
  );

  const resetAllPanels = useCallback(() => {
    for (const id of KIOSK_PANEL_IDS) {
      closeWindow(id);
    }
    dockSourceRef.current = {};
    if (manifestationId) clearKioskPanelModes(manifestationId);
    setModes(INITIAL_MODES());
  }, [closeWindow, manifestationId, setModes]);

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      const panelId = data?.panelId;
      if (!panelId || !KIOSK_PANEL_IDS.includes(panelId)) return;

      if (data.type === KIOSK_DOCK_MESSAGE) {
        dockPanel(panelId, 'popped');
        return;
      }

      if (data.type === KIOSK_WINDOW_CLOSED_MESSAGE) {
        clearCloseWatch(panelId);
        windowsRef.current[panelId] = null;
        delete dockSourceRef.current[panelId];
        setModes((prev) =>
          prev[panelId] === 'popped' ? { ...prev, [panelId]: 'embedded' } : prev,
        );
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [clearCloseWatch, dockPanel, setModes]);

  /** Stato popped: riallaccia watch; se la finestra non c’è più → pannello in dashboard. */
  useEffect(() => {
    for (const id of KIOSK_PANEL_IDS) {
      if (panelModes[id] !== 'popped') continue;
      const win = windowsRef.current[id];
      if (win && !win.closed) {
        watchPopOutClosed(id, win);
      } else {
        setModes((prev) =>
          prev[id] === 'popped' ? { ...prev, [id]: 'embedded' } : prev,
        );
      }
    }
    return () => {
      for (const id of KIOSK_PANEL_IDS) clearCloseWatch(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount / tenant
  }, [manifestationId]);

  useEffect(() => {
    if (manifestationId) {
      savedRef.current = loadKioskPanelModes(manifestationId);
      setPanelModes(loadInitialModes(manifestationId));
    }
  }, [manifestationId]);

  const dockedPanelIds = KIOSK_PANEL_IDS.filter((id) => panelModes[id] === 'docked');

  return {
    panelModes,
    dockedPanelIds,
    popOutPanel,
    dockPanel,
    restorePanel,
    embedPanel,
    resetAllPanels,
    /** Visibile solo se incorporato in dashboard (non pop-out né dock). */
    isPanelVisible: (panelId) => panelModes[panelId] === 'embedded',
    isPanelPopped: (panelId) => panelModes[panelId] === 'popped',
  };
}
