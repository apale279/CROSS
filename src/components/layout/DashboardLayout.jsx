import { Outlet, useLocation } from 'react-router-dom';
import { KioskPopOutProvider } from '../../context/KioskPopOutContext';
import { RouteErrorBoundary } from '../ui/RouteErrorFallback';
import { AppHeader } from './AppHeader';
import { ActivityRouteListener } from '../auth/ActivityRouteListener';
import { PmaArrivoAlertListener } from '../pma/PmaArrivoAlertListener';
import { PmaDiarioAlertListener } from '../pma/PmaDiarioAlertListener';
import { SosAlertListener } from '../sos/SosAlertListener';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/' || pathname === '';

  return (
    <KioskPopOutProvider>
      <ActivityRouteListener />
      <SosAlertListener />
      <PmaDiarioAlertListener />
      <PmaArrivoAlertListener />
      <div className="flex h-screen flex-col bg-slate-100">
        <AppHeader />
        <main
          className={`min-h-0 flex-1 ${isDashboard ? 'overflow-hidden' : 'overflow-y-auto'}`}
        >
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </KioskPopOutProvider>
  );
}
