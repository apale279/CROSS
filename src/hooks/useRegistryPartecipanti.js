import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { registryPartecipantiPathSegments } from '../lib/firestorePaths';
import { useFirestoreSync } from '../context/FirestoreSyncContext';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { migrateLegacyRegistryFromImpostazioniDoc } from '../services/registryPartecipantiService';

function legacyLooksPopulated(legacy) {
  return (
    Array.isArray(legacy) &&
    legacy.some((x) => x && (x.nome || x.cognome || x.telefono || x.dataNascita))
  );
}

/**
 * Partecipanti dalla sotto-collezione Impostazioni; migrazione one-shot dal campo legacy `registryPartecipanti`.
 */
export function useRegistryPartecipanti(legacyArrayFromDoc) {
  const manifestationId = useManifestazioneId();
  const { reportSync, reportError } = useFirestoreSync();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const migrationStarted = useRef(false);
  const legacyRef = useRef(legacyArrayFromDoc);
  legacyRef.current = legacyArrayFromDoc;
  const legacyLen = Array.isArray(legacyArrayFromDoc) ? legacyArrayFromDoc.length : 0;

  useEffect(() => {
    if (!manifestationId || migrationStarted.current || legacyLen === 0) return;
    const leg = legacyRef.current;
    if (!legacyLooksPopulated(leg)) return;
    migrationStarted.current = true;
    void migrateLegacyRegistryFromImpostazioniDoc(manifestationId, leg ?? []).catch((e) =>
      console.warn('Migr. registry partecipanti:', e),
    );
  }, [manifestationId, legacyLen]);

  useEffect(() => {
    if (!manifestationId) return undefined;
    const col = collection(db, ...registryPartecipantiPathSegments(manifestationId));

    const unsub = onSnapshot(
      col,
      (snap) => {
        reportSync();
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            const pettorale =
              typeof data.pettorale === 'number'
                ? data.pettorale
                : Number(data.pettorale) || 0;
            return {
              pettorale,
              nome: data.nome ?? '',
              cognome: data.cognome ?? '',
              dataNascita: data.dataNascita ?? '',
              telefono: data.telefono ?? '',
            };
          })
          .filter((r) => r.pettorale > 0)
          .sort((a, b) => a.pettorale - b.pettorale);
        setRows(list);
        setLoading(false);
      },
      (err) => {
        reportError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [manifestationId, reportSync, reportError]);

  return useMemo(
    () => ({
      registryPartecipanti: rows,
      loadingRegistry: loading && rows.length === 0,
    }),
    [rows, loading],
  );
}
