import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { TENANT_ID as TENANT_ID_ENV } from '../constants';
import { COLLECTIONS } from '../lib/firestorePaths';

const TenantContext = createContext(null);

/**
 * Risolve l'ID documento sotto `manifestazioni/{id}`:
 * 1) `VITE_TENANT_ID` in .env se presente
 * 2) altrimenti, se esiste un solo documento in `manifestazioni`, usa quello
 */
export function TenantProvider({ children }) {
  const envId = TENANT_ID_ENV;
  const [state, setState] = useState(() => {
    if (envId) {
      return {
        tenantId: envId,
        loading: false,
        error: null,
        source: 'env',
      };
    }
    return { tenantId: null, loading: true, error: null, source: null };
  });

  useEffect(() => {
    if (envId) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const snap = await getDocs(query(collection(db, COLLECTIONS.manifestazioni), limit(2)));
        if (cancelled) return;
        if (snap.empty) {
          setState({ tenantId: null, loading: false, error: 'empty', source: null });
        } else if (snap.size > 1) {
          console.warn(
            '[TenantContext] Più documenti in manifestazioni: uso il primo. ' +
              'Per scegliere esplicitamente, imposta VITE_TENANT_ID in .env.local.',
          );
          setState({
            tenantId: snap.docs[0].id,
            loading: false,
            error: null,
            source: 'firestore-first',
          });
        } else {
          setState({
            tenantId: snap.docs[0].id,
            loading: false,
            error: null,
            source: 'firestore',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            tenantId: null,
            loading: false,
            error: e?.message ?? 'Errore sconosciuto',
            source: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [envId]);

  const value = useMemo(
    () => state,
    [state.tenantId, state.loading, state.error, state.source],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext() {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error('useTenantContext deve essere usato dentro TenantProvider');
  }
  return ctx;
}
