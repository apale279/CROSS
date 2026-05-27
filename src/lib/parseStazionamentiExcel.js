import * as XLSX from 'xlsx';

const TIPO_STAZIONAMENTO_MAX = 48;

/** Converte cella coordinate (es. `45.86, 9.40`) in `{ lat, lng }`. */
export function parseCoordinateCell(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') {
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  const s = String(raw).trim();
  const parts = s.split(/[,;]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
  }
  return null;
}

function isHeaderRow(row) {
  const a = String(row?.[0] ?? '')
    .trim()
    .toUpperCase();
  return (
    a === 'STAZIONAMENTO' ||
    a === 'NOME STAZIONAMENTO' ||
    a.includes('NOME STAZIONAMENTO')
  );
}

/**
 * Foglio STAZIONAMENTI: A nome, B indirizzo, C coordinate, D note, E tipo.
 * @param {unknown[][]} aoa
 */
export function parseStazionamentiSheet(aoa) {
  const out = [];
  const seen = new Set();
  let startRow = 0;
  if (aoa.length && isHeaderRow(aoa[0])) startRow = 1;

  for (let i = startRow; i < aoa.length; i += 1) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;

    const nome = String(row[0] ?? '').trim();
    if (!nome) continue;

    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let tipo_stazionamento = String(row[4] ?? '').trim();
    if (tipo_stazionamento.length > TIPO_STAZIONAMENTO_MAX) {
      tipo_stazionamento = tipo_stazionamento.slice(0, TIPO_STAZIONAMENTO_MAX);
    }

    out.push({
      nome,
      indirizzo: String(row[1] ?? '').trim(),
      coordinate: parseCoordinateCell(row[2]),
      note: String(row[3] ?? '').trim(),
      tipo_stazionamento,
      luogo_fisico: '',
    });
  }

  return out;
}

function pickStazionamentiSheetName(sheetNames) {
  const exact = sheetNames.find((n) => n.trim().toUpperCase() === 'STAZIONAMENTI');
  if (exact) return exact;
  return (
    sheetNames.find((n) => n.toUpperCase().includes('STAZIONAMENT')) ?? sheetNames[0] ?? ''
  );
}

/** @param {ArrayBuffer} arrayBuffer */
export function parseStazionamentiExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = pickStazionamentiSheetName(wb.SheetNames);
  const sheet = sheetName ? wb.Sheets[sheetName] : null;
  if (!sheet) return { sheetName: '', entries: [] };

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  return { sheetName, entries: parseStazionamentiSheet(aoa) };
}

/** Aggiunge `id` univoci per Firestore impostazioni. */
export function stazionamentiEntriesWithIds(entries) {
  return (entries ?? []).map((e) => ({
    id: crypto.randomUUID(),
    nome: e.nome,
    tipo_stazionamento: e.tipo_stazionamento ?? '',
    note: e.note ?? '',
    indirizzo: e.indirizzo ?? '',
    luogo_fisico: e.luogo_fisico ?? '',
    coordinate: e.coordinate ?? null,
  }));
}
