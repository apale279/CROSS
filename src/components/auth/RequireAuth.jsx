import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InactivityLogoutGuard } from './InactivityLogoutGuard';
import { SessionRevocationGuard } from './SessionRevocationGuard';

const E2E_AUTO_LOGIN =
  import.meta.env.DEV && import.meta.env.VITE_E2E_AUTO_LOGIN === 'true';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading || (E2E_AUTO_LOGIN && !user)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">
          {E2E_AUTO_LOGIN && !user ? 'Accesso test automatico…' : 'Verifica accesso…'}
        </p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <>
      <SessionRevocationGuard />
      {!E2E_AUTO_LOGIN && <InactivityLogoutGuard />}
      <Outlet />
    </>
  );
}
