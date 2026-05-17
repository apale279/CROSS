import { createContext, useContext } from 'react';
import { useManifestazioneIdOptional } from './ManifestazioneContext';
import { useKioskPopOut } from '../hooks/useKioskPopOut';

const KioskPopOutContext = createContext(null);

export function KioskPopOutProvider({ children }) {
  const manifestationId = useManifestazioneIdOptional() ?? '';
  const value = useKioskPopOut(manifestationId);
  return (
    <KioskPopOutContext.Provider value={value}>{children}</KioskPopOutContext.Provider>
  );
}

export function useKioskPopOutContext() {
  const ctx = useContext(KioskPopOutContext);
  if (!ctx) {
    throw new Error('useKioskPopOutContext richiede KioskPopOutProvider');
  }
  return ctx;
}

/** Solo dashboard: null se provider assente (non dovrebbe accadere). */
export function useKioskPopOutContextOptional() {
  return useContext(KioskPopOutContext);
}
