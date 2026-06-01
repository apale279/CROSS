import { Outlet } from 'react-router-dom';
import { useNotifyKioskWindowClosed } from '../../hooks/useNotifyKioskWindowClosed';
import { KioskSchedaProvider } from '../../context/KioskSchedaContext';
import { RouteErrorBoundary } from '../ui/RouteErrorFallback';
import { SandboxBadge } from '../sandbox/SandboxBadge';
import { useSandboxUi } from '../../context/SandboxUiContext';

export function KioskLayout() {
  useNotifyKioskWindowClosed();
  const { showSandboxBadge } = useSandboxUi();

  return (
    <KioskSchedaProvider>
      <div className="relative h-screen w-screen overflow-hidden bg-slate-50">
        {showSandboxBadge ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[100]">
            <SandboxBadge className="text-[11px] px-2 py-1" />
          </div>
        ) : null}
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
