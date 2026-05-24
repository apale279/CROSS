import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { pazientiPath } from '../lib/firestorePaths';
import { normalizePatientDoc } from '../lib/pazienteDefaults';

/** Snapshot live del documento paziente. */
export function usePazienteDocument(patientDocId) {
  const manifestationId = useManifestazioneId();
  const [rawDoc, setRawDoc] = useState(null);
  const [loading, setLoading] = useState(Boolean(patientDocId));

  useEffect(() => {
    if (!manifestationId || !patientDocId) {
      setRawDoc(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const ref = doc(db, ...pazientiPath(manifestationId), patientDocId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setRawDoc(snap.exists() ? normalizePatientDoc({ _docId: snap.id, ...snap.data() }) : null);
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, [manifestationId, patientDocId]);

  return { rawDoc, loading, manifestationId };
}
