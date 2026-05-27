import * as XLSX from 'xlsx';
import { mezzoPatchFromStazionamentoNome } from './mezzoStazionamentoAssign';
import { emojiFromSeed, normalizeTipiMezzo } from './tipiMezzo';

function isFlottaHeaderRow(row) {
  const a = String(row?.[0] ?? '')
    .trim()
    .toUpperCase();
  return (
    a === 'CODICE MEZZO' ||
    a === 'SIGLA' ||
    a === 'NOME MEZZO' ||
    a.includes('CODICE MEZZO')
  );
}

function pickFlottaSheetName(sheetNames) {
  const exact = sheetNames.find((n) => n.trim().toUpperCase() === 'FLOTTA');
  if (exact) return exact;
  return sheetNames[0] ?? '';
}

/**
 * Foglio FLOTTA: A sigla, B tipo mezzo, C nome stazionamento (indirizzo da elenco Impostazioni).
 * @param {unknown[][]} aoa
 */
export function parseFlottaMezziSheet(aoa) {
  const out = [];
  const seen = new Set();
  let startRow = 0;
  if (aoa.length && isFlottaHeaderRow(aoa[0])) startRow = 1;

  for (let i = startRow; i < aoa.length; i += 1) {
    const row = aoa[i];
    if (!Array.isArray(row)) continue;

    const sigla = String(row[0] ?? '')
      .trim()
      .replace(/\s+/g, '');
    if (!sigla) continue;

    const key = sigla.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({
      sigla,
      tipo: String(row[1] ?? '').trim(),
      stazionamentoNome: String(row[2] ?? '').trim(),
    });
  }

  return out;
}

/** @param {ArrayBuffer} arrayBuffer */
export function parseFlottaMezziExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
  const sheetName = pickFlottaSheetName(wb.SheetNames);
  const sheet = sheetName ? wb.Sheets[sheetName] : null;
  if (!sheet) return { sheetName: '', entries: [] };

  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
  return { sheetName, entries: parseFlottaMezziSheet(aoa) };
}

export function normalizeStazionamentoNomeKey(nome) {
  return String(nome ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Trova preset stazionamento per nome (es. «@ LECCO AFFARI», «LECCO CNSAS»). */
export function findStazionamentoByNome(nome, stazionamenti) {
  const key = normalizeStazionamentoNomeKey(nome);
  if (!key) return null;
  return (
    (stazionamenti ?? []).find((s) => normalizeStazionamentoNomeKey(s.nome) === key) ?? null
  );
}

/** Aggiunge tipi mezzo mancanti (emoji automatica). */
export function mergeTipiMezzoForImport(existingTipi, tipoNames) {
  const tipiMezzo = normalizeTipiMezzo(existingTipi);
  const seen = new Set(tipiMezzo.map((t) => t.nome.toLowerCase()));
  const tipiAggiunti = [];

  for (const raw of tipoNames ?? []) {
    const nome = String(raw ?? '').trim();
    if (!nome) continue;
    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tipiMezzo.push({ nome, emoji: emojiFromSeed(nome) });
    tipiAggiunti.push(nome);
  }

  return { tipiMezzo, tipiAggiunti };
}

/**
 * Piano import mezzi da Excel FLOTTA.
 * @param {{ rows: { sigla: string; tipo: string; stazionamentoNome: string }[]; stazionamenti: object[]; tipiMezzo: object[]; existingMezzi: object[]; normalizeMezzoKey: (s: string) => string }}
 */
export function buildMezziImportPlan({
  rows,
  stazionamenti,
  tipiMezzo,
  existingMezzi,
  normalizeMezzoKey,
}) {
  const { tipiMezzo: nextTipi, tipiAggiunti } = mergeTipiMezzoForImport(
    tipiMezzo,
    rows.map((r) => r.tipo),
  );

  const existingKeys = new Set(
    (existingMezzi ?? []).map((m) =>
      normalizeMezzoKey(String(m.sigla ?? m._docId ?? '').trim()),
    ),
  );

  const toCreate = [];
  const skipped = [];
  const missingStazionamenti = new Set();

  for (const row of rows) {
    const nk = normalizeMezzoKey(row.sigla);
    if (existingKeys.has(nk)) {
      skipped.push(row.sigla);
      continue;
    }

    const tipoHit =
      nextTipi.find((t) => t.nome.toLowerCase() === row.tipo.toLowerCase()) ?? null;
    const tipoNome = tipoHit?.nome ?? row.tipo;

    const preset = findStazionamentoByNome(row.stazionamentoNome, stazionamenti);
    if (row.stazionamentoNome && !preset) {
      missingStazionamenti.add(row.stazionamentoNome);
    }

    toCreate.push({
      sigla: row.sigla,
      payload: {
        tipo: tipoNome,
        ...mezzoPatchFromStazionamentoNome(row.stazionamentoNome, stazionamenti),
      },
    });
    existingKeys.add(nk);
  }

  return {
    toCreate,
    skipped,
    missingStazionamenti: [...missingStazionamenti],
    nextTipi,
    tipiAggiunti,
  };
}
