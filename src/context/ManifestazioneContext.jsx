import { createContext, useContext } from 'react';
import { useTenantContext } from './TenantContext';

const ManifestazioneIdContext = createContext(null);

/**
 * Fornisce l'ID tenant già risolto (montato da AppDataShell dopo il guard loading/tenant).
 * Evita race su loading: i figli leggono una stringa stabile, non lo stato grezzo di TenantContext.
 */
export function ManifestazioneIdProvider({ tenantId, children }) {
  return (
    <ManifestazioneIdContext.Provider value={tenantId}>{children}</ManifestazioneIdContext.Provider>
  );
}

/**
 * ID documento Firestore in `manifestazioni/{id}` (da env o unico documento in collezione).
 */
export function useManifestationId() {
  const fromProvider = useContext(ManifestazioneIdContext);
  if (fromProvider) return fromProvider;

  const { tenantId, loading } = useTenantContext();
  if (loading || !tenantId) {
    throw new Error('useManifestationId: tenant non ancora disponibile');
  }
  return tenantId;
}

export const useManifestazioneId = useManifestationId;

export function useManifestationIdOptional() {
  const { tenantId } = useTenantContext();
  return tenantId ?? null;
}

export const useManifestazioneIdOptional = useManifestationIdOptional;
