import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { KIOSK_PATH_TO_PANEL, KIOSK_WINDOW_CLOSED_MESSAGE } from '../lib/kioskPopOut';

/** Avvisa la dashboard quando l’utente chiude la finestra pop-out. */
export function useNotifyKioskWindowClosed() {
  const { pathname } = useLocation();
  const panelId = KIOSK_PATH_TO_PANEL[pathname];

  useEffect(() => {
    if (!panelId) return undefined;

    const notify = () => {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          { type: KIOSK_WINDOW_CLOSED_MESSAGE, panelId },
          window.location.origin,
        );
      }
    };

    window.addEventListener('beforeunload', notify);
    window.addEventListener('pagehide', notify);
    return () => {
      window.removeEventListener('beforeunload', notify);
      window.removeEventListener('pagehide', notify);
    };
  }, [panelId]);
}
