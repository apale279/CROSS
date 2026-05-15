import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const FirestoreSyncContext = createContext(null);

export function FirestoreSyncProvider({ children }) {
  const [online, setOnline] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);

  const reportSync = useCallback(() => {
    setOnline(true);
    setLastSyncAt(new Date());
    setError(null);
  }, []);

  const reportError = useCallback((err) => {
    setOnline(false);
    setError(err?.message ?? 'Errore Firestore');
  }, []);

  const value = useMemo(
    () => ({ online, lastSyncAt, error, reportSync, reportError }),
    [online, lastSyncAt, error, reportSync, reportError],
  );

  return (
    <FirestoreSyncContext.Provider value={value}>{children}</FirestoreSyncContext.Provider>
  );
}

export function useFirestoreSync() {
  const ctx = useContext(FirestoreSyncContext);
  if (!ctx) {
    throw new Error('useFirestoreSync va usato dentro FirestoreSyncProvider');
  }
  return ctx;
}

export function useFirestoreSyncOptional() {
  return useContext(FirestoreSyncContext);
}
