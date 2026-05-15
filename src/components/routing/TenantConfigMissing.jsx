import { useTenantContext } from '../../context/TenantContext';

/** Messaggio se tenant non risolvibile (stesso testo usato dopo login). */
export function TenantConfigMissing() {
  const { error } = useTenantContext();

  if (error === 'empty') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Nessun ambiente operativo</h1>
        <p className="max-w-md text-sm text-slate-600">
          La collezione <code className="rounded bg-slate-200 px-1">manifestazioni</code> è vuota.
          Crea un documento in Firestore oppure imposta{' '}
          <code className="rounded bg-slate-200 px-1">VITE_TENANT_ID</code> in{' '}
          <code className="rounded bg-slate-200 px-1">.env.local</code>.
        </p>
      </div>
    );
  }

  if (error === 'multiple') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Più ambienti in Firestore</h1>
        <p className="max-w-md text-sm text-slate-600">
          Sono presenti più documenti in <code className="rounded bg-slate-200 px-1">manifestazioni</code>.
          Specifica quale usare con{' '}
          <code className="rounded bg-slate-200 px-1">VITE_TENANT_ID</code> in{' '}
          <code className="rounded bg-slate-200 px-1">.env.local</code> (ID documento).
        </p>
      </div>
    );
  }

  if (error && error !== 'empty' && error !== 'multiple') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
        <h1 className="text-xl font-bold text-slate-900">Errore Firestore</h1>
        <p className="max-w-md text-sm text-slate-600">{error}</p>
        <p className="max-w-md text-xs text-slate-500">
          In alternativa imposta manualmente <code className="rounded bg-slate-200 px-1">VITE_TENANT_ID</code> in{' '}
          <code className="rounded bg-slate-200 px-1">.env.local</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 text-center">
      <h1 className="text-xl font-bold text-slate-900">Configurazione mancante</h1>
      <p className="max-w-md text-sm text-slate-600">
        Imposta <code className="rounded bg-slate-200 px-1">VITE_TENANT_ID</code> in{' '}
        <code className="rounded bg-slate-200 px-1">.env.local</code> con l&apos;ID del documento
        Firestore sotto <code className="rounded bg-slate-200 px-1">manifestazioni</code>.
      </p>
    </div>
  );
}
