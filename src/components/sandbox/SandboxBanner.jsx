import { getProductionTenantId } from '../../lib/sandboxMode';

function shortId(id) {
  const s = String(id ?? '').trim();
  if (s.length <= 12) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

export function SandboxBanner({ tenantId }) {
  const prod = getProductionTenantId();

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[10000] flex h-10 items-center justify-center gap-3 border-b-2 border-amber-700 bg-amber-400 px-3 text-center text-sm font-bold tracking-wide text-amber-950 shadow-md"
      role="status"
      aria-live="polite"
    >
      <span>SANDBOX</span>
      <span className="hidden font-normal sm:inline">— dati di prova, non produzione</span>
      {tenantId ? (
        <span className="rounded bg-amber-500/60 px-2 py-0.5 text-xs font-semibold">
          tenant {shortId(tenantId)}
        </span>
      ) : null}
      {prod ? (
        <span className="hidden text-xs font-normal text-amber-900 md:inline">
          (prod bloccata: {shortId(prod)})
        </span>
      ) : null}
    </div>
  );
}
