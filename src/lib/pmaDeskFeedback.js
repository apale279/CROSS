/**
 * Feedback non bloccante per operazioni desk PMA (letti, drag, stati).
 * Non interferisce con apertura/modifica cartella clinica.
 */
export function logPmaDeskWarning(message, hint) {
  const extra = hint ?? 'La cartella clinica resta sempre apribile.';
  if (typeof console !== 'undefined') {
    console.warn('[PMA desk]', message, extra);
  }
}

/** Avviso operatore: problema secondario, gestione paziente non bloccata. */
export function notifyPmaDeskSoftIssue(message, hint) {
  logPmaDeskWarning(message, hint);
  if (typeof window !== 'undefined' && message) {
    window.alert(
      `${message}\n\n${hint ?? 'Puoi aprire e compilare la cartella clinica in ogni momento.'}`,
    );
  }
}

/** Errore operazione primaria (es. presa in carico non riuscita). */
export function notifyPmaDeskError(message) {
  if (typeof console !== 'undefined') console.error('[PMA desk]', message);
  if (typeof window !== 'undefined' && message) {
    window.alert(message);
  }
}
