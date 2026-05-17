import { getTelegramTenantId } from './env.js';

/**
 * Tenant da body richiesta (app) o da variabili server / webhook query.
 * @param {import('http').IncomingMessage} [req]
 * @param {Record<string, unknown>} [body]
 */
export function resolveTenantFromRequest(req, body = {}) {
  const fromBody = String(body.manifestationId ?? body.tenantId ?? '').trim();
  if (fromBody) return fromBody;

  const q = req?.query ?? {};
  const fromQuery = String(q.tenant ?? q.manifestationId ?? q.tenantId ?? '').trim();
  if (fromQuery) return fromQuery;

  try {
    return getTelegramTenantId();
  } catch {
    return '';
  }
}

/** @throws {Error & { status?: number }} */
export function requireTenant(req, body) {
  const id = resolveTenantFromRequest(req, body);
  if (!id) {
    throw Object.assign(
      new Error(
        'Tenant non configurato: imposta TELEGRAM_TENANT_ID su Vercel, passa manifestationId dal client, oppure ?tenant= nel webhook Telegram.',
      ),
      { status: 400 },
    );
  }
  return id;
}
