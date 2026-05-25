import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InactivityLogoutGuard } from './InactivityLogoutGuard';
import { SessionRevocationGuard } from './SessionRevocationGuard';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Verifica accesso…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  return (
    <>
      <SessionRevocationGuard />
      <InactivityLogoutGuard />
      <Outlet />
    </>
  );
}
