import { Outlet, useLocation } from 'react-router-dom';
import { KioskPopOutProvider } from '../../context/KioskPopOutContext';
import { RouteErrorBoundary } from '../ui/RouteErrorFallback';
import { AppHeader } from './AppHeader';
import { PmaOperatorBottomNav } from './PmaOperatorBottomNav';
import { usePmaFieldUx } from '../../pma/hooks/usePmaFieldUx';
import { ActivityRouteListener } from '../auth/ActivityRouteListener';
import { PmaArrivoAlertListener } from '../pma/PmaArrivoAlertListener';
import { PmaChiamaTriageAlertListener } from '../pma/PmaChiamaTriageAlertListener';
import { PmaDiarioAlertListener } from '../pma/PmaDiarioAlertListener';
import { SosAlertListener } from '../sos/SosAlertListener';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/' || pathname === '';
  const pmaFieldUx = usePmaFieldUx();

  return (
    <KioskPopOutProvider>
      <ActivityRouteListener />
      <SosAlertListener />
      <PmaDiarioAlertListener />
      <PmaArrivoAlertListener />
      <PmaChiamaTriageAlertListener />
      <div className="flex h-screen flex-col bg-slate-100">
        <AppHeader />
        <PmaOperatorBottomNav />
        <main
          className={`min-h-0 flex-1 ${isDashboard ? 'overflow-hidden' : 'overflow-y-auto'} ${
            pmaFieldUx ? 'pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))]' : ''
          }`}
        >
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </KioskPopOutProvider>
  );
}
