import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { SandboxTenantBlocked } from '../components/sandbox/SandboxTenantBlocked';
import { COLLECTIONS } from '../lib/firestorePaths';
import {
  isProductionTenantId,
  isSandboxAppEnv,
  isSandboxMisconfigured,
  shouldShowSandboxBadge,
} from '../lib/sandboxMode';
import { useTenantContext } from './TenantContext';

const SandboxUiContext = createContext({ showSandboxBadge: false });

export function SandboxUiProvider({ children }) {
  const { tenantId, loading: tenantLoading } = useTenantContext();
  const [manifestSandbox, setManifestSandbox] = useState(false);
  const [manifestChecked, setManifestChecked] = useState(false);

  useEffect(() => {
    if (!tenantId) {
      setManifestSandbox(false);
      setManifestChecked(false);
      return undefined;
    }
    let cancelled = false;
    setManifestChecked(false);
    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.manifestazioni, tenantId));
        if (!cancelled) {
          setManifestSandbox(snap.exists() && snap.data()?.sandbox === true);
        }
      } catch {
        if (!cancelled) setManifestSandbox(false);
      } finally {
        if (!cancelled) setManifestChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const showSandboxBadge = shouldShowSandboxBadge({ manifestSandbox });
  const misconfigured = isSandboxMisconfigured();
  const blockedByTenant =
    !tenantLoading &&
    tenantId &&
    manifestChecked &&
    (misconfigured || (isSandboxAppEnv() && isProductionTenantId(tenantId)));

  const value = useMemo(() => ({ showSandboxBadge }), [showSandboxBadge]);

  if (blockedByTenant) {
    return (
      <SandboxTenantBlocked
        tenantId={tenantId}
        reason={misconfigured ? 'misconfigured' : 'production-tenant'}
      />
    );
  }

  return <SandboxUiContext.Provider value={value}>{children}</SandboxUiContext.Provider>;
}

export function useSandboxUi() {
  return useContext(SandboxUiContext);
}
