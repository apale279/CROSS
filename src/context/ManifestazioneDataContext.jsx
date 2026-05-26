import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS, PATH_BY_KEY } from '../lib/firestorePaths';
import { filterManifestazioneDataForProfile } from '../lib/manifestazioneDataScope';
import { useFirestoreSync } from './FirestoreSyncContext';
import { useAuth } from './AuthContext';
import { useTenantContext } from './TenantContext';

const ManifestazioneDataContext = createContext(null);

const COLLECTION_KEYS = {
  [COLLECTIONS.eventi]: 'eventi',
  [COLLECTIONS.missioni]: 'missioni',
  [COLLECTIONS.mezzi]: 'mezzi',
  [COLLECTIONS.pazienti]: 'pazienti',
  [COLLECTIONS.note_diario]: 'noteDiario',
};

function subscribeNested(pathFn, manifestationId, onData, reportSync, reportError) {
  const colRef = collection(db, ...pathFn(manifestationId));
  return onSnapshot(
    colRef,
    (snap) => {
      reportSync();
      onData(
        snap.docs.map((d) => ({
          _docId: d.id,
          ...d.data(),
        })),
      );
    },
    (err) => {
      console.error('Firestore listener:', err);
      reportError(err);
      onData([]);
    },
  );
}

export function ManifestazioneDataProvider({ children }) {
  const { tenantId } = useTenantContext();
  const { reportSync, reportError } = useFirestoreSync();
  const [eventi, setEventi] = useState([]);
  const [missioni, setMissioni] = useState([]);
  const [mezzi, setMezzi] = useState([]);
  const [pazienti, setPazienti] = useState([]);
  const [noteDiario, setNoteDiario] = useState([]);
  const [loading, setLoading] = useState({
    eventi: true,
    missioni: true,
    mezzi: true,
    pazienti: true,
    noteDiario: true,
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!tenantId) return undefined;

    setLoading({
      eventi: true,
      missioni: true,
      mezzi: true,
      pazienti: true,
      noteDiario: true,
    });
    setError(null);

    const markLoaded = (key) => {
      setLoading((prev) => ({ ...prev, [key]: false }));
    };

    const unsubs = [
      subscribeNested(
        PATH_BY_KEY.eventi,
        tenantId,
        (rows) => {
          setEventi(rows);
          markLoaded('eventi');
        },
        reportSync,
        (err) => {
          setError(err.message);
          markLoaded('eventi');
        },
      ),
      subscribeNested(
        PATH_BY_KEY.missioni,
        tenantId,
        (rows) => {
          setMissioni(rows);
          markLoaded('missioni');
        },
        reportSync,
        (err) => {
          setError(err.message);
          markLoaded('missioni');
        },
      ),
      subscribeNested(
        PATH_BY_KEY.mezzi,
        tenantId,
        (rows) => {
          setMezzi(rows);
          markLoaded('mezzi');
        },
        reportSync,
        (err) => {
          setError(err.message);
          markLoaded('mezzi');
        },
      ),
      subscribeNested(
        PATH_BY_KEY.pazienti,
        tenantId,
        (rows) => {
          setPazienti(rows);
          markLoaded('pazienti');
        },
        reportSync,
        (err) => {
          setError(err.message);
          markLoaded('pazienti');
        },
      ),
      subscribeNested(
        PATH_BY_KEY.note_diario,
        tenantId,
        (rows) => {
          setNoteDiario(rows);
          markLoaded('noteDiario');
        },
        reportSync,
        (err) => {
          setError(err.message);
          markLoaded('noteDiario');
        },
      ),
    ];

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [tenantId, reportSync, reportError]);

  const value = useMemo(
    () => ({
      eventi,
      missioni,
      mezzi,
      pazienti,
      noteDiario,
      loading,
      error,
    }),
    [eventi, missioni, mezzi, pazienti, noteDiario, loading, error],
  );

  return (
    <ManifestazioneDataContext.Provider value={value}>
      {children}
    </ManifestazioneDataContext.Provider>
  );
}

export function useManifestazioneData() {
  const ctx = useContext(ManifestazioneDataContext);
  if (!ctx) {
    throw new Error('useManifestazioneData va usato dentro ManifestazioneDataProvider');
  }
  return ctx;
}

export function useManifestazioneCollection(collectionName) {
  const raw = useManifestazioneData();
  const { profile } = useAuth();
  const scoped = useMemo(
    () => filterManifestazioneDataForProfile(raw, profile),
    [raw, profile],
  );
  const key = COLLECTION_KEYS[collectionName];
  if (!key) {
    throw new Error(`Collezione non supportata: ${collectionName}`);
  }
  const dataMap = {
    eventi: scoped.eventi,
    missioni: scoped.missioni,
    mezzi: scoped.mezzi,
    pazienti: scoped.pazienti,
    noteDiario: scoped.noteDiario,
  };
  return {
    data: dataMap[key],
    loading: raw.loading[key],
    error: raw.error,
  };
}
