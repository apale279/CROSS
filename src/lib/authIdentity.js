/**
 * Nome utente → email sintetica univoca per tenant (Firebase Auth richiede formato email).
 */
export function sanitizeNomeUtente(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s;
}

export function authEmailFromNomeUtente(nomeUtente, tenantId) {
  const slug = sanitizeNomeUtente(nomeUtente);
  if (!slug) {
    throw new Error('Inserisci un nome utente valido (lettere, numeri, . _ -).');
  }
  const safeTenant = String(tenantId ?? '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  if (!safeTenant) {
    throw new Error('Ambiente manifestazione non valido.');
  }
  return `${slug}__${safeTenant}@cross-app.local`;
}
