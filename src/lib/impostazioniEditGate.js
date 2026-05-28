/**
 * Gate sincronizzato dal profilo utente (AuthProvider).
 * Blocca solo scritture di configurazione su `impostazioni`, non i dati operativi
 * (es. statistiche farmaci consumati in tenda).
 */
/** Default conservativo finché il profilo non conferma i permessi. */
let canEditImpostazioniConfig = false;

export function setImpostazioniConfigCanEdit(allowed) {
  canEditImpostazioniConfig = Boolean(allowed);
}

export function getImpostazioniConfigCanEdit() {
  return canEditImpostazioniConfig;
}

export function assertCanEditImpostazioniConfig() {
  if (!canEditImpostazioniConfig) {
    throw new Error(
      'Account in sola lettura: non puoi modificare le impostazioni. Contatta un amministratore.',
    );
  }
}
