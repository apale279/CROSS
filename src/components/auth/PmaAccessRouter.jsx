import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import { isPathAllowedForPmaOperator } from '../../lib/userAccess';

/** Operatori PMA: solo /pma, /pazienti, /diario, /account. Centrale: accesso completo. */
export function PmaAccessRouter() {
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
    if (scopeId) {
      return <Navigate to={`/pma/${encodeURIComponent(scopeId)}`} replace />;
    }
    return (
      <div className="mx-auto max-w-lg p-8 text-center text-sm text-slate-600">
        Profilo operatore PMA incompleto o PMA non assegnato. Contatta la centrale.
      </div>
    );
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
