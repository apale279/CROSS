import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { IS_SUPERADMIN } from '../constants';
import { useImpostazioni } from './useImpostazioni';
import {
  effectivePmaScopeId,
  isPmaOperatorProfile,
  listaPmaImpostazioni,
  userHasFullCentraleAccess,
} from '../lib/pmaModule';

export function usePmaAccess() {
  const { profile, profileLoading } = useAuth();
  const { impostazioni, loading: impostazioniLoading } = useImpostazioni();

  return useMemo(() => {
    const allPma = listaPmaImpostazioni(impostazioni);
    /** Solo profilo Firestore: VITE_SUPERADMIN non bypassa più il menu per tutti. */
    const fullCentrale = userHasFullCentraleAccess(profile, false);
    const scopeId = effectivePmaScopeId(profile, IS_SUPERADMIN);
    const isPmaOperator = isPmaOperatorProfile(profile);
    const accessiblePma = scopeId ? allPma.filter((p) => p.id === scopeId) : allPma;

    return {
      loading: impostazioniLoading || profileLoading,
      allPma,
      accessiblePma,
      scopeId,
      fullCentrale,
      isPmaOperator,
      /** Menu ristretto: chiunque non sia centrale esplicita. */
      restrictedNav: !fullCentrale,
    };
  }, [impostazioni, profile, profileLoading, impostazioniLoading]);
}
