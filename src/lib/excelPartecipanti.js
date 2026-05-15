import * as XLSX from 'xlsx';

/** Converte una cella Excel in ISO `YYYY-MM-DD` (stringa). */
export function cellToIsoDate(cell) {
  if (cell == null || cell === '') return '';
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'number' && cell > 20000 && cell < 65000) {
    const utcDays = Math.floor(cell - 25569);
    const ms = utcDays * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(cell).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return s.slice(0, 10);
}

export function etaDaDataNascita(iso) {
  if (!iso || typeof iso !== 'string' || iso.length < 10) return null;
  const [ys, ms, ds] = iso.split('-').map(Number);
  if (!ys || !ms || !ds) return null;
  const bd = new Date(ys, ms - 1, ds);
  if (Number.isNaN(bd.getTime())) return null;
  let age = new Date().getFullYear() - bd.getFullYear();
  const m = new Date().getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && new Date().getDate() < bd.getDate())) age -= 1;
  return Math.max(0, age);
}

/**
 * Colonne: A pettorale, B nome, C cognome, D data di nascita, E telefono.
 */
export function parseExcelPartecipanti(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });

  /** @type {Map<number, {pettorale: number; nome: string; cognome: string; dataNascita: string; telefono: string}>} */
  const byPett = new Map();

  for (let i = 0; i < aoa.length; i += 1) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;

    const rawP = row[0];
    if (rawP == null || String(rawP).trim() === '') continue;

    let pettorale;
    if (typeof rawP === 'number' && Number.isFinite(rawP)) {
      pettorale = Math.trunc(rawP);
    } else {
      pettorale = parseInt(String(rawP).trim().replace(/\s/g, '') || 'NaN', 10);
    }
    if (!Number.isFinite(pettorale) || pettorale < 1) continue;

    const nome = row[1] != null ? String(row[1]).trim() : '';
    const cognome = row[2] != null ? String(row[2]).trim() : '';
    const dataNascita = cellToIsoDate(row[3]);
    const telefono = row[4] != null ? String(row[4]).trim() : '';

    if (!nome && !cognome && !dataNascita && !telefono) continue;

    byPett.set(pettorale, { pettorale, nome, cognome, dataNascita, telefono });
  }

  return [...byPett.values()].sort((a, b) => a.pettorale - b.pettorale);
}

export function cercaPerPettorale(lista, numero) {
  const n =
    typeof numero === 'number' && Number.isFinite(numero)
      ? Math.trunc(numero)
      : parseInt(String(numero ?? '').trim().replace(/\s/g, '') || 'NaN', 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return (lista ?? []).find((row) => Number(row?.pettorale) === n) ?? null;
}
