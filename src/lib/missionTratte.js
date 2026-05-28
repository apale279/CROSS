import { Timestamp } from 'firebase/firestore';

function newId() {
  return typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
    ? globalThis.crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function quandoToDate(quando) {
  if (!quando) return null;
  if (typeof quando.toDate === 'function') return quando.toDate();
  if (quando instanceof Date) return quando;
  const d = new Date(quando);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Tratte / tappe missione: timestamp + descrizione libera (es. rientro in sede per rifornimento).
 * Ordinate cronologicamente.
 */
export function normalizeTratteMissione(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t) => t && typeof t === 'object')
    .map((t) => {
      const quando = quandoToDate(t.quando);
      if (!quando) return null;
      return {
        id: typeof t.id === 'string' && t.id ? t.id : newId(),
        descrizione: String(t.descrizione ?? ''),
        quando,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

/** Payload Firestore (array nel documento missione). */
export function tratteMissioneToFirestore(tratte) {
  return (tratte ?? []).map((t) => {
    const d = t.quando instanceof Date ? t.quando : new Date(t.quando);
    return {
      id: t.id,
      descrizione: String(t.descrizione ?? ''),
      quando: Timestamp.fromDate(d),
    };
  });
}

export function nuovaTrattaMissione(descrizione = '') {
  return {
    id: newId(),
    descrizione,
    quando: new Date(),
  };
}
