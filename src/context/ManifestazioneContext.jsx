import { useTenantContext } from './TenantContext';

/**
 * ID documento Firestore in `manifestazioni/{id}` (da env o unico documento in collezione).
 */
export function useManifestationId() {
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
