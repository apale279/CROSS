#!/usr/bin/env node
/**
 * Importa TIPO EVENTO e DETTAGLIO EVENTO da Excel in Firestore impostazioni.
 *
 * Struttura file: riga 1 = tipi (una per colonna), righe sotto = dettagli di quella colonna.
 *
 * Uso:
 *   node --env-file=.env.local scripts/import-impostazioni-eventi.mjs
 *   node --env-file=.env.local scripts/import-impostazioni-eventi.mjs "percorso/file.xlsx"
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function stripEnv(value) {
  const s = String(value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function parseExcel(path) {
  const wb = XLSX.read(readFileSync(path));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rows.length) throw new Error('Foglio Excel vuoto');

  const tipiEvento = [];
  const dettagliPerTipoEvento = {};
  const header = rows[0] ?? [];

  for (let c = 0; c < header.length; c++) {
    const tipo = String(header[c] ?? '').trim();
    if (!tipo) continue;

    tipiEvento.push(tipo);
    const dettagli = [];
    for (let r = 1; r < rows.length; r++) {
      const cell = String(rows[r][c] ?? '').trim();
      if (cell) dettagli.push(cell);
    }
    dettagliPerTipoEvento[tipo] = dettagli;
  }

  if (!tipiEvento.length) throw new Error('Nessun tipo evento nella prima riga');
  return { tipiEvento, dettagliPerTipoEvento };
}

function initAdmin() {
  const raw = stripEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON mancante');
  const serviceAccount = JSON.parse(raw);
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  return getFirestore();
}

const excelPath = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(ROOT, 'Voci impostazioni.xlsx');

if (!existsSync(excelPath)) {
  console.error('File non trovato:', excelPath);
  process.exit(1);
}

const tenantId =
  stripEnv(process.env.TELEGRAM_TENANT_ID) || stripEnv(process.env.VITE_TENANT_ID);
if (!tenantId) {
  console.error('Imposta TELEGRAM_TENANT_ID o VITE_TENANT_ID');
  process.exit(1);
}

const { tipiEvento, dettagliPerTipoEvento } = parseExcel(excelPath);
const db = initAdmin();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);

await ref.set(
  {
    manifestationId: tenantId,
    tipiEvento,
    dettagliPerTipoEvento,
  },
  { merge: true },
);

console.log('Import completato su', ref.path);
console.log('Tipi evento:', tipiEvento.length);
for (const tipo of tipiEvento) {
  console.log(`  • ${tipo}: ${dettagliPerTipoEvento[tipo]?.length ?? 0} dettagli`);
}
