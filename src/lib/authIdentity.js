/**
 * Messaggio errore oppure null se il nome utente è accettato.
 * Non sono ammessi spazi; formato consigliato: nome.cognome (es. mario.rossi).
 */
export function validateNomeUtente(raw) {
  const value = String(raw ?? '');
  if (!value.trim()) {
    return 'Inserisci il nome utente.';
  }
  if (/\s/.test(value)) {
    return 'Il nome utente non può contenere spazi. Usa il formato suggerito: nome.cognome (es. mario.rossi).';
  }
  const t = value.trim();
  if (!/^[a-zA-Z0-9._-]+$/.test(t)) {
    return 'Usa solo lettere, numeri, punto (.), underscore (_) e trattino (-). Esempio: mario.rossi';
  }
  if (t.length < 3) {
    return 'Il nome utente deve avere almeno 3 caratteri.';
  }
  return null;
}

/** Normalizza dopo validazione: trim + lowercase. */
export function normalizeNomeUtente(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function authEmailFromNomeUtente(nomeUtente, tenantId) {
  const errMsg = validateNomeUtente(nomeUtente);
  if (errMsg) {
    throw new Error(errMsg);
  }
  const slug = normalizeNomeUtente(nomeUtente);
  const safeTenant = String(tenantId ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  if (!safeTenant) {
    throw new Error('Ambiente manifestazione non valido.');
  }
  return `${slug}__${safeTenant}@cross-app.local`;
}
