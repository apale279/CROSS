import { pazientiPath } from '../../lib/firestorePaths';

export function pmaFieldLocksRef(manifestationId, pazienteDocId) {
  return [...pazientiPath(manifestationId), pazienteDocId, 'pmaPresence', 'locks'];
}

/** Millisecondi dopo i quali un lock senza heartbeat è considerato scaduto. */
export const PMA_FIELD_LOCK_STALE_MS = 45_000;

/** Ritardo rilascio lock al blur: il salvataggio onBlur parte prima del release. */
export const PMA_FIELD_LOCK_RELEASE_DELAY_MS = 450;
