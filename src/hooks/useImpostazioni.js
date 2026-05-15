import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { normalizeImpostazioni } from '../lib/impostazioniNormalize';
import { useManifestationId } from '../context/ManifestazioneContext';
import { useFirestoreSync } from '../context/FirestoreSyncContext';
import { impostazioniDocRef } from '../services/impostazioniService';

/** Lettura completa impostazioni (altre pagine). Ogni campo si aggiorna dallo snapshot senza setDoc distruttivi. */
export function useImpostazioni() {
  const manifestationId = useManifestationId();
  const { reportSync, reportError } = useFirestoreSync();
  const [impostazioni, setImpostazioni] = useState(DEFAULT_IMPOSTAZIONI);
  const [loading, setLoading] = useState(true);
  const [docExists, setDocExists] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const docRef = impostazioniDocRef(manifestationId);

    const unsub = onSnapshot(
      docRef,
      async (snap) => {
        if (cancelled) return;
        reportSync();

        if (!snap.exists()) {
          setDocExists(false);
          setImpostazioni(DEFAULT_IMPOSTAZIONI);
          setLoading(false);
          return;
        }

        setDocExists(true);
        setImpostazioni(normalizeImpostazioni(snap.data()));
        setLoading(false);
      },
      (err) => {
        console.error('onSnapshot impostazioni:', err);
        reportError(err);
        if (!cancelled) setLoading(false);
      },
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [manifestationId, reportSync, reportError]);

  return { impostazioni, loading, docExists };
}
