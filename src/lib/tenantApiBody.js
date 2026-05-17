import { TENANT_ID } from '../constants';

/** Aggiunge manifestationId/tenantId al body API server (Telegram, ecc.). */
export function tenantApiBody(manifestationId, fields = {}) {
  const id = (manifestationId ?? TENANT_ID ?? '').trim();
  if (!id) return { ...fields };
  return { ...fields, manifestationId: id, tenantId: id };
}
