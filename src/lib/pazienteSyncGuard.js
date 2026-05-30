import { normalizeStatoPzPma, STATO_PZ_PMA } from './pmaModule';

const SANITARIO_TO_PMA = {
  Bianco: 'bianco',
  Verde: 'verde',
  Giallo: 'giallo',
  Rosso: 'rosso',
};

export function coloreSanitarioToPmaCodiceLocal(codice) {
  return SANITARIO_TO_PMA[String(codice ?? '').trim()] ?? null;
}

/** Sync automatico centrale → PMA bloccato: il PMA ha preso in carico la cartella. */
export function pmaCodiceColoreSyncBlocked(paziente) {
  const stato = normalizeStatoPzPma(paziente?.statoPzPma);
  if (
    stato === STATO_PZ_PMA.IN_ATTESA ||
    stato === STATO_PZ_PMA.IN_CARICO ||
    stato === STATO_PZ_PMA.DIMESSO
  ) {
    return true;
  }
  return Boolean(paziente?.pmaScheda?.ingresso_carico_at);
}

/**
 * Conflitto triage PMA vs nuovo codice centrale: il PMA ha un colore diverso da quello che
 * verrebbe applicato automaticamente.
 */
export function detectPmaCodiceColoreConflict(paziente, codiceColoreCentrale) {
  if (!paziente?.pmaScheda || pmaCodiceColoreSyncBlocked(paziente)) return null;
  const nextPma = coloreSanitarioToPmaCodiceLocal(codiceColoreCentrale);
  if (!nextPma) return null;
  const currentPma = String(paziente.pmaScheda.codice_colore ?? '').trim().toLowerCase();
  if (!currentPma || currentPma === nextPma) return null;
  return {
    type: 'pma_codice_colore',
    currentPma,
    nextPma,
    codiceColoreCentrale: String(codiceColoreCentrale ?? '').trim(),
  };
}

export function pmaCodiceColoreConflictMessage(conflict) {
  if (!conflict) return '';
  const pmaLabel = (v) =>
    ({ bianco: 'Bianco', verde: 'Verde', giallo: 'Giallo', rosso: 'Rosso' })[v] ?? v;
  return (
    `In PMA il triage è «${pmaLabel(conflict.currentPma)}», in centrale stai impostando «${conflict.codiceColoreCentrale}» (→ ${pmaLabel(conflict.nextPma)} in PMA).\n\n` +
    'OK = allinea il triage PMA al colore centrale\n' +
    'Annulla = mantieni il triage PMA attuale'
  );
}
