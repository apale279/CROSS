import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import { getDefaultAppPath } from '../../lib/defaultAppPath';
import { isPathAllowedForPmaOperator } from '../../lib/userAccess';

/** Operatori PMA: solo /pma, /pazienti, /diario, /account. Centrale: accesso completo. */
export function PmaAccessRouter() {
  const { profile } = useAuth();
  const { scopeId, loading, accessiblePma, restrictedNav } = usePmaAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Caricamento accessi PMA…
      </div>
    );
  }

  if (restrictedNav && !isPathAllowedForPmaOperator(location.pathname)) {
    return <Navigate to={getDefaultAppPath(profile)} replace />;
  }

  if (restrictedNav && location.pathname.startsWith('/pma') && accessiblePma.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">
        Nessun PMA assegnato al tuo profilo. Contatta la centrale.
      </div>
    );
  }

  return <Outlet />;
}
