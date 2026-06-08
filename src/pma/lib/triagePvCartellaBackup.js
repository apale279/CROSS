import { patchPazientePmaGranular } from './pazientePmaPatch';

/**
 * Copia in background una riga PV triage nella tabella `parametri_vitali` (cartella clinica).
 * Stesso id riga: merge granulare per campo (valori vuoti client non cancellano server).
 */
export async function mirrorTriagePvRowToCartella(manifestationId, docId, row) {
  if (!manifestationId || !docId || !row?.id) return;
  await patchPazientePmaGranular(manifestationId, docId, {
    parametri_vitali: [row],
  });
}

/** Fire-and-forget: errori di backup non bloccano l'UI. */
export function mirrorTriagePvRowToCartellaSafe(manifestationId, docId, row) {
  void mirrorTriagePvRowToCartella(manifestationId, docId, row).catch((err) => {
    if (import.meta.env?.DEV) {
      console.warn('[triagePvCartellaBackup]', err);
    }
  });
}
