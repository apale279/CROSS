import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from '../lib/firestorePaths';
import { useTenantContext } from '../context/TenantContext';

export function useManifestazione() {
  const { tenantId } = useTenantContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return undefined;
    const ref = doc(db, COLLECTIONS.manifestazioni, tenantId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setData({ _docId: snap.id, ...snap.data() });
      } else {
        setData(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [tenantId]);

  return { manifestazione: data, loading };
}
