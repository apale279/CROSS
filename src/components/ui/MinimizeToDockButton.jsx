import { Minus } from 'lucide-react';
import { KIOSK_DOCK_MESSAGE } from '../../lib/kioskPopOut';

/**
 * Riduce a icona sulla barra dashboard (chiude la finestra pop-out o notifica la finestra madre).
 * @param {string} panelId - operativo | mezzi | mappa
 * @param {(panelId: string) => void} [onDock] - Finestra madre: riduce il pannello flottante
 */
export function MinimizeToDockButton({ panelId, onDock }) {
  const dock = () => {
    if (onDock) {
      onDock(panelId);
      return;
    }
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: KIOSK_DOCK_MESSAGE, panelId },
        window.location.origin,
      );
    }
    window.close();
  };

  return (
    <button
      type="button"
      onClick={dock}
      className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-amber-800"
      title="Riduci a icona sulla barra centrale"
      aria-label="Riduci a icona sulla barra centrale"
    >
      <Minus className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
