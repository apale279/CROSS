import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePmaAccess } from '../../hooks/usePmaAccess';

/** Operatori con `pmaScopeId` vedono solo le rotte /pma. */
export function PmaAccessRouter() {
  const { scopeId, fullCentrale, loading, accessiblePma } = usePmaAccess();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-slate-600">
        Caricamento accessi PMA…
      </div>
    );
  }

  if (scopeId && !location.pathname.startsWith('/pma')) {
    return <Navigate to={`/pma/${encodeURIComponent(scopeId)}`} replace />;
  }

  if (!fullCentrale && location.pathname.startsWith('/pma') && accessiblePma.length === 0) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">
        Nessun PMA assegnato al tuo profilo. Contatta la centrale.
      </div>
    );
  }

  return <Outlet />;
}
