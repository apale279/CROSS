import { Outlet } from 'react-router-dom';
import { useNotifyKioskWindowClosed } from '../../hooks/useNotifyKioskWindowClosed';
import { KioskSchedaProvider } from '../../context/KioskSchedaContext';
import { RouteErrorBoundary } from '../ui/RouteErrorFallback';

export function KioskLayout() {
  useNotifyKioskWindowClosed();

  return (
    <KioskSchedaProvider>
      <div className="app-viewport-h relative w-screen overflow-hidden bg-slate-50">
        <div
          className="pointer-events-none absolute right-3 top-3 z-[100] rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-900 shadow-sm"
          aria-live="polite"
        >
          🔴 MONITOR MODE - SOLA LETTURA
        </div>
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </div>
    </KioskSchedaProvider>
  );
}
