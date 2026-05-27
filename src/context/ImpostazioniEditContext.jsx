import { createContext, useContext, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { IS_SUPERADMIN } from '../constants';
import { userCanEditImpostazioni } from '../lib/userAccess';

const ImpostazioniEditContext = createContext({ canEdit: true });

export function ImpostazioniEditProvider({ children }) {
  const { profile, profileLoading } = useAuth();
  const canEdit = useMemo(
    () => userCanEditImpostazioni(profile, IS_SUPERADMIN),
    [profile],
  );

  const value = useMemo(
    () => ({ canEdit, profileLoading }),
    [canEdit, profileLoading],
  );

  return (
    <ImpostazioniEditContext.Provider value={value}>{children}</ImpostazioniEditContext.Provider>
  );
}

export function useImpostazioniEdit() {
  return useContext(ImpostazioniEditContext);
}
