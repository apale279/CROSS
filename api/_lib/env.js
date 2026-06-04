/** Variabili server (Vercel → Settings → Environment Variables). */

/** Rimuove virgolette se Vercel le ha salvate nel valore (es. `"Lr4XjZ..."`). */
export function stripEnvValue(value) {
  const s = (value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

export function getTelegramBotToken() {
  const token = stripEnvValue(process.env.TELEGRAM_BOT_TOKEN);
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN non configurato su Vercel');
  return token;
}

export function getTelegramTenantId() {
  const id =
    stripEnvValue(process.env.TELEGRAM_TENANT_ID) ||
    stripEnvValue(process.env.VITE_TENANT_ID) ||
    '';
  if (!id) {
    throw new Error('TELEGRAM_TENANT_ID (o VITE_TENANT_ID) non configurato su Vercel');
  }
  return id;
}
export function getWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || '';
}
