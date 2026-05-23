import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { IS_SUPERADMIN } from '../constants';
import { useImpostazioni } from './useImpostazioni';
import {
  effectivePmaScopeId,
  listaPmaImpostazioni,
  userHasFullCentraleAccess,
} from '../lib/pmaModule';

export function usePmaAccess() {
  const { profile } = useAuth();
  const { impostazioni, loading } = useImpostazioni();

  return useMemo(() => {
    const allPma = listaPmaImpostazioni(impostazioni);
    const scopeId = effectivePmaScopeId(profile, IS_SUPERADMIN);
    const fullCentrale = userHasFullCentraleAccess(profile, IS_SUPERADMIN);
    const accessiblePma = scopeId ? allPma.filter((p) => p.id === scopeId) : allPma;

    return {
      loading,
      allPma,
      accessiblePma,
      scopeId,
      fullCentrale,
      isPmaOperator: Boolean(scopeId),
    };
  }, [impostazioni, profile, loading]);
}
