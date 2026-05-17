import { collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export function sosAlertsPath(manifestationId) {
  return ['manifestazioni', manifestationId, 'sos_alerts'];
}

export function subscribeSosAlerts(manifestationId, onAlerts) {
  const q = query(
    collection(db, ...sosAlertsPath(manifestationId)),
    where('acknowledged', '==', false),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        _docId: d.id,
        ...d.data(),
      }));
      rows.sort(
        (a, b) =>
          (b.creatoIl?.toMillis?.() ?? 0) - (a.creatoIl?.toMillis?.() ?? 0),
      );
      onAlerts(rows);
    },
    (err) => {
      console.error('sos_alerts listener:', err);
      onAlerts([]);
    },
  );
}

export async function acknowledgeSosAlert(manifestationId, alertDocId) {
  const ref = doc(db, ...sosAlertsPath(manifestationId), alertDocId);
  await updateDoc(ref, {
    acknowledged: true,
    acknowledgedAt: serverTimestamp(),
  });
}
