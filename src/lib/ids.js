/**
 * UUID locale (righe PV/farmaci, draft UI).
 * Su HTTP non-localhost (es. 192.168.x.x) `crypto.randomUUID` non esiste → fallback.
 */
export function newLocalId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/** Identificatore stabile (non riutilizzato). Non mostrato in UI. */
export function newIdUnivoco() {
  return newLocalId();
}
