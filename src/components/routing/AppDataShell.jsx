import { Outlet } from 'react-router-dom';
import { FirestoreSyncProvider } from '../../context/FirestoreSyncContext';
import { ManifestazioneDataProvider } from '../../context/ManifestazioneDataContext';
import { useTenantContext } from '../../context/TenantContext';
import { TenantConfigMissing } from './TenantConfigMissing';

function AppDataShellInner() {
  const { tenantId, loading } = useTenantContext();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-600">Caricamento configurazione…</p>
      </div>
    );
  }

  if (!tenantId) {
    return <TenantConfigMissing />;
  }

  return (
    <FirestoreSyncProvider>
      <ManifestazioneDataProvider>
        <Outlet />
      </ManifestazioneDataProvider>
    </FirestoreSyncProvider>
  );
}

export function AppDataShell() {
  return <AppDataShellInner />;
}
