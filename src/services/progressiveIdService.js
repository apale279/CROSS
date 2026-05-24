import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { maxProgressiveFromItems, nextProgressiveId } from './idGenerator';

function contatoriRef(manifestationId) {
  return doc(db, 'manifestazioni', manifestationId, 'settings', 'contatori');
}

/** Allinea il contatore Firestore al massimo già presente in memoria (dati legacy). */
async function ensureCounterAtLeast(manifestationId, counterKey, seedItems, displayField, prefix) {
  const seedMax = maxProgressiveFromItems(prefix, seedItems, displayField);
  if (seedMax <= 0) return;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contatoriRef(manifestationId));
    const current = snap.exists() ? Number(snap.data()[counterKey] ?? 0) : 0;
    if (seedMax > current) {
      transaction.set(contatoriRef(manifestationId), { [counterKey]: seedMax }, { merge: true });
    }
  });
}

/**
 * ID progressivo atomico (E1, M2, P3…) su `settings/contatori`.
 * `seedItems` evita collisioni con record creati prima dell'introduzione del contatore.
 */
export async function allocateProgressiveId(
  manifestationId,
  prefix,
  counterKey,
  seedItems,
  displayField,
) {
  if (seedItems?.length) {
    await ensureCounterAtLeast(manifestationId, counterKey, seedItems, displayField, prefix);
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const ref = contatoriRef(manifestationId);
      const snap = await transaction.get(ref);
      const prev = snap.exists() ? Number(snap.data()[counterKey] ?? 0) : 0;
      const next = prev + 1;
      transaction.set(ref, { [counterKey]: next }, { merge: true });
      return `${prefix}${next}`;
    });
  } catch (err) {
    console.warn('[allocateProgressiveId] fallback client-side:', err);
    return nextProgressiveId(prefix, seedItems ?? [], displayField);
  }
}
