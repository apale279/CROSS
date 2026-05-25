import { useAuth } from '../../context/AuthContext';
import { useTenantContext } from '../../context/TenantContext';
import { usePmaAccess } from '../../hooks/usePmaAccess';
import { isPmaMedicoAccount } from '../../lib/userAccess';
import { isPmaOperatorProfile } from '../../lib/pmaModule';

/** Solo dev: stato accesso PMA/centrale in tempo reale. */
export function AccessDebugStrip() {
  if (!import.meta.env.DEV) return null;

  const { tenantId } = useTenantContext();
  const { user, profile, profileLoading } = useAuth();
  const access = usePmaAccess();

  if (typeof window !== 'undefined') {
    window.__CROSS_ACCESS_DEBUG__ = {
      tenantId,
      uid: user?.uid ?? null,
      email: user?.email ?? null,
      profileLoading,
      profile,
      access,
      isPmaOperator: isPmaOperatorProfile(profile),
      isPmaMedico: isPmaMedicoAccount(profile),
    };
  }

  const items = [
    ['tenant', tenantId ?? '—'],
    ['uid', user?.uid?.slice(0, 8) ?? '—'],
    ['email', user?.email ?? '—'],
    ['profLoad', profileLoading ? 'yes' : 'no'],
    ['accessType', profile?.accessType ?? '—'],
    ['pmaRank', profile?.pmaRank ?? '—'],
    ['pmaScope', profile?.pmaScopeId ?? '—'],
    ['fullCentrale', access.fullCentrale ? 'yes' : 'no'],
    ['restricted', access.restrictedNav ? 'yes' : 'no'],
    ['scopeId', access.scopeId ?? '—'],
    ['pmaOp', access.isPmaOperator ? 'yes' : 'no'],
  ];

  return (
    <div
      className="w-full border-b border-amber-300 bg-amber-50 px-3 py-1.5 font-mono text-[10px] leading-relaxed text-amber-950"
      title="Debug accessi (solo dev). Console: window.__CROSS_ACCESS_DEBUG__"
    >
      <span className="mr-2 font-bold uppercase">Debug accessi</span>
      {items.map(([k, v]) => (
        <span key={k} className="mr-3 whitespace-nowrap">
          {k}=<strong>{String(v)}</strong>
        </span>
      ))}
    </div>
  );
}
