export function maxProgressiveFromItems(prefix, items, fieldName) {
  let max = 0;
  for (const item of items ?? []) {
    const raw = item[fieldName] ?? item._docId ?? '';
    const match = String(raw).match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }
  return max;
}

/** Fallback client-side se la transazione contatore non è disponibile. */
export function nextProgressiveId(prefix, items, fieldName) {
  return `${prefix}${maxProgressiveFromItems(prefix, items, fieldName) + 1}`;
}
