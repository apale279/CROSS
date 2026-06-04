import { getProductionTenantId } from '../../lib/sandboxMode';

export function SandboxTenantBlocked({ tenantId, reason = 'production-tenant' }) {
  const prod = getProductionTenantId();

  const message =
    reason === 'misconfigured'
      ? 'VITE_TENANT_ID punta ancora al tenant di produzione su un deploy SANDBOX.'
      : 'L’app sandbox è collegata al database di produzione. Le scritture sono bloccate.';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-amber-50 px-6 text-center">
      <p className="text-lg font-bold uppercase tracking-wide text-amber-900">SANDBOX — accesso bloccato</p>
      <p className="mt-4 max-w-lg text-sm text-amber-950">{message}</p>
      <dl className="mt-6 rounded-lg border border-amber-300 bg-white px-4 py-3 text-left text-sm text-slate-800">
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="font-medium">Tenant attivo</dt>
          <dd className="font-mono text-xs">{tenantId || '—'}</dd>
          <dt className="font-medium">Tenant produzione</dt>
          <dd className="font-mono text-xs">{prod || '—'}</dd>
        </div>
      </dl>
      <p className="mt-6 max-w-md text-xs text-slate-600">
        Su Vercel (progetto sandbox): imposta <code className="rounded bg-slate-200 px-1">VITE_TENANT_ID</code>{' '}
        con l’ID in <code className="rounded bg-slate-200 px-1">sandbox/TENANT_ID</code>,{' '}
        <code className="rounded bg-slate-200 px-1">VITE_APP_SANDBOX=true</code> e rifai il deploy.
      </p>
    </div>
  );
}
