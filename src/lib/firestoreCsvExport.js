/** Valore serializzabile per CSV / JSON export. */
export function serializeForExport(value, seen = new WeakSet()) {
  if (value == null) return null;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value.toMillis === 'function') return new Date(value.toMillis()).toISOString();
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map((v) => serializeForExport(v, seen));
  }
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  seen.add(value);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = serializeForExport(v, seen);
  }
  return out;
}

export function cellSerialize(value) {
  if (value == null) return '';
  if (typeof value === 'object') {
    return JSON.stringify(serializeForExport(value));
  }
  return String(value);
}

export function escapeCsvCell(raw) {
  const str = String(raw ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function rowsToCsv(headers, rows) {
  const head = headers.map(escapeCsvCell).join(',');
  const body = rows.map((row) => headers.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
  return `\ufeff${[head, ...body].join('\r\n')}`;
}

export function collectHeaders(rows) {
  const set = new Set(['_docId']);
  for (const row of rows) {
    for (const k of Object.keys(row)) set.add(k);
  }
  const headers = [...set];
  const rest = headers.filter((h) => h !== '_docId').sort();
  return ['_docId', ...rest];
}

export function docToExportRow(docId, data, extra = {}) {
  const row = { _docId: docId, ...extra };
  if (!data || typeof data !== 'object') return row;
  for (const [key, value] of Object.entries(data)) {
    if (key === 'pmaScheda') {
      row.pmaScheda_json = JSON.stringify(serializeForExport(value ?? {}));
      continue;
    }
    row[key] = cellSerialize(value);
  }
  return row;
}

export function buildCsvFromRows(rows) {
  if (!rows.length) {
    return rowsToCsv(['_docId'], []);
  }
  const headers = collectHeaders(rows);
  return rowsToCsv(headers, rows);
}
