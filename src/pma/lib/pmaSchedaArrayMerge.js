/**
 * Unione multiselect: aggiunge voci client, rimuove solo etichette in `removeLabels`.
 * Non interpreta mai un array client più corto come deselezione implicita (multi-operatore).
 */
export function mergeStringSelectionArray(serverArr, clientArr, removeLabels = []) {
  const removeSet = new Set((removeLabels ?? []).map(String));
  const out = new Set(
    (Array.isArray(serverArr) ? serverArr : []).map(String).filter((x) => !removeSet.has(x)),
  );
  for (const x of Array.isArray(clientArr) ? clientArr : []) {
    const s = String(x);
    if (!removeSet.has(s)) out.add(s);
  }
  return [...out];
}

function isEmptyMergeValue(val) {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim() === '';
  return false;
}

/** Unisce campi riga: valori client non vuoti vincono; vuoti client non cancellano server (stale UI). */
export function mergeSchedaRowById(serverItem, clientItem) {
  if (!serverItem) return clientItem;
  if (!clientItem) return serverItem;
  const id = serverItem.id ?? clientItem.id;
  const merged = { ...serverItem, id };
  const keys = new Set([...Object.keys(serverItem), ...Object.keys(clientItem)]);
  for (const key of keys) {
    if (key === 'id') continue;
    const clientVal = clientItem[key];
    const serverVal = serverItem[key];
    if (!isEmptyMergeValue(clientVal)) {
      merged[key] = clientVal;
    } else if (!isEmptyMergeValue(serverVal)) {
      merged[key] = serverVal;
    } else {
      merged[key] = clientVal ?? serverVal;
    }
  }
  return merged;
}

/**
 * Merge array per `id`: upsert voci client sullo snapshot server.
 * Rimuove solo id elencati in `removeIds` (rimozione esplicita da UI).
 */
export function mergeSchedaArrayById(serverArr, clientArr, removeIds = []) {
  const server = Array.isArray(serverArr) ? serverArr : [];
  const client = Array.isArray(clientArr) ? clientArr : [];
  const removeSet = new Set((removeIds ?? []).map(String));

  const byId = new Map();
  for (const item of server) {
    const id = item?.id;
    if (!id || removeSet.has(String(id))) continue;
    byId.set(String(id), item);
  }
  for (const item of client) {
    const id = item?.id;
    if (!id || removeSet.has(String(id))) continue;
    const prev = byId.get(String(id));
    byId.set(String(id), prev ? mergeSchedaRowById(prev, item) : item);
  }
  return Array.from(byId.values());
}

/**
 * Lesioni: chiave stabile `n` (non rinumerare al remove — evita collisioni in merge).
 * Rimuove solo numeri in `removeNs`.
 */
export function mergeLesioniByN(serverArr, clientArr, removeNs = []) {
  const server = Array.isArray(serverArr) ? serverArr : [];
  const client = Array.isArray(clientArr) ? clientArr : [];
  const removeSet = new Set((removeNs ?? []).map((x) => Number(x)));

  const byN = new Map();
  for (const item of server) {
    const n = item?.n;
    if (n == null || Number.isNaN(Number(n)) || removeSet.has(Number(n))) continue;
    byN.set(Number(n), item);
  }
  for (const item of client) {
    const n = item?.n;
    if (n == null || Number.isNaN(Number(n)) || removeSet.has(Number(n))) continue;
    byN.set(Number(n), item);
  }
  return Array.from(byN.values()).sort((a, b) => Number(a.n) - Number(b.n));
}
