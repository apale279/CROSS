import { pazientiPath } from '../../lib/firestorePaths';

export function pmaFieldLocksRef(manifestationId, pazienteDocId) {
  return [...pazientiPath(manifestationId), pazienteDocId, 'pmaPresence', 'locks'];
}

/** Millisecondi dopo i quali un lock senza heartbeat è considerato scaduto. */
export const PMA_FIELD_LOCK_STALE_MS = 45_000;
