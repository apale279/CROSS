import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Lettura in tempo reale di una collezione root filtrata per manifestationId.
 */
export function useFirestoreCollection(collectionName, manifestationId) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collectionName || !manifestationId) {
      setData([]);
      setLoading(false);
      return undefined;
    }

    const colRef = collection(db, collectionName);
    const q = query(colRef, where('manifestationId', '==', manifestationId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        setData(
          snap.docs.map((d) => ({
            _docId: d.id,
            ...d.data(),
          })),
        );
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [collectionName, manifestationId]);

  return { data, loading, error };
}
