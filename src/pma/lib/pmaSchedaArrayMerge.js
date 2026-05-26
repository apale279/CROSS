/**
 * Merge array per `id`: aggiorna/aggiunge voci client; se il client invia un sottoinsieme
 * (es. eliminazione farmaco) prevale la lista client per quella operazione.
 */
export function mergeSchedaArrayById(serverArr, clientArr) {
  const server = Array.isArray(serverArr) ? serverArr : [];
  const client = Array.isArray(clientArr) ? clientArr : [];

  const serverIds = new Set(server.map((x) => x?.id).filter(Boolean));
  const clientIds = new Set(client.map((x) => x?.id).filter(Boolean));
  const clientHasIds = clientIds.size > 0;

  if (clientHasIds) {
    const clientSubset = [...clientIds].every((id) => serverIds.has(id));
    if (clientSubset && client.length < server.length) {
      return client;
    }
    const byId = new Map();
    for (const item of server) {
      if (item?.id) byId.set(item.id, item);
    }
    for (const item of client) {
      if (item?.id) byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }

  if (typeof client[0] === 'string' || typeof server[0] === 'string') {
    return client;
  }

  return client.length ? client : server;
}
