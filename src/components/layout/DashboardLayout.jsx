import { Outlet, useLocation } from 'react-router-dom';
import { EventoSchedaProvider } from '../../context/EventoSchedaContext';
import { GoogleMapsProvider } from '../../context/GoogleMapsContext';
import { RouteErrorBoundary } from '../ui/RouteErrorFallback';
import { AppHeader } from './AppHeader';
import { ActivityRouteListener } from '../auth/ActivityRouteListener';

export function DashboardLayout() {
  const { pathname } = useLocation();
  const isDashboard = pathname === '/' || pathname === '';

  return (
    <GoogleMapsProvider>
      <EventoSchedaProvider>
        <ActivityRouteListener />
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
      </EventoSchedaProvider>
    </GoogleMapsProvider>
  );
}
