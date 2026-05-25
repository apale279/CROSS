import { Table2, Truck, Map, Tent } from 'lucide-react';
import { KIOSK_PANEL_CONFIG } from '../../lib/kioskPopOut';

const ICONS = {
  operativo: Table2,
  mezzi: Truck,
  mappa: Map,
  pma: Tent,
};

/**
 * Icone pannelli ridotti a icona (finestra esterna chiusa, ripristino al click).
 */
export function KioskDockBar({ dockedPanelIds, onRestore }) {
  if (!dockedPanelIds.length) return null;

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-100 px-1 py-0.5"
      role="toolbar"
      aria-label="Monitor esterni — pannelli ridotti"
    >
      {dockedPanelIds.map((panelId) => {
        const cfg = KIOSK_PANEL_CONFIG[panelId];
        const Icon = ICONS[panelId];
        return (
          <button
            key={panelId}
            type="button"
            onClick={() => onRestore(panelId)}
            className="flex items-center gap-1 rounded-md border border-transparent bg-white px-2 py-1 text-xs font-bold uppercase text-sky-900 shadow-sm hover:border-sky-300 hover:bg-sky-50"
            title={`Ripristina: ${cfg.label}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="hidden sm:inline">{cfg.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
