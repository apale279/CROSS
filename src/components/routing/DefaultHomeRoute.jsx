import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getDefaultAppPath } from '../../lib/defaultAppPath';
import DashboardPage from '../../pages/DashboardPage';

/** `/` → dashboard centrale oppure redirect alla tenda PMA assegnata. */
export function DefaultHomeRoute() {
  const { profile, profileLoading } = useAuth();

  if (profileLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Caricamento profilo…
      </div>
    );
  }

  const target = getDefaultAppPath(profile);
  if (target !== '/') {
    return <Navigate to={target} replace />;
  }

  return <DashboardPage />;
}
