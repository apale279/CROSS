#!/usr/bin/env node
/**
 * Importa stazionamenti dal foglio STAZIONAMENTI di «FLOTTA RESEGUP 2026.xlsx».
 * Colonne: A nome, B indirizzo, C coordinate, D note, E tipo.
 *
 * Uso:
 *   node --env-file=.env.local scripts/import-stazionamenti-flotta.mjs
 *   node --env-file=.env.local scripts/import-stazionamenti-flotta.mjs "Prompt_local/file.xlsx"
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

const excelPath = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(ROOT, 'Prompt_local', 'FLOTTA RESEGUP 2026.xlsx');

if (!existsSync(excelPath)) {
  console.error('File non trovato:', excelPath);
  process.exit(1);
}

const { parseStazionamentiSheet, stazionamentiEntriesWithIds } = await import(
  pathToFileURL(join(ROOT, 'src/lib/parseStazionamentiExcel.js')).href
);

const wb = XLSX.read(readFileSync(excelPath));
const sheetName =
  wb.SheetNames.find((n) => n.trim().toUpperCase() === 'STAZIONAMENTI') ??
  wb.SheetNames.find((n) => n.toUpperCase().includes('STAZIONAMENT')) ??
  wb.SheetNames[0];
const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
const parsed = parseStazionamentiSheet(aoa);
if (!parsed.length) {
  console.error('Nessuno stazionamento nel foglio', sheetName);
  process.exit(1);
}

const stazionamenti = stazionamentiEntriesWithIds(parsed);

function initAdmin() {
  const raw = stripEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON mancante');
  const serviceAccount = JSON.parse(raw);
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  return getFirestore();
}

const tenantId =
  stripEnv(process.env.TELEGRAM_TENANT_ID) || stripEnv(process.env.VITE_TENANT_ID);
if (!tenantId) {
  console.error('Imposta TELEGRAM_TENANT_ID o VITE_TENANT_ID');
  process.exit(1);
}

const db = initAdmin();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);

await ref.set({ manifestationId: tenantId, stazionamenti }, { merge: true });

console.log('Import stazionamenti completato su', ref.path);
console.log('Foglio:', sheetName, '— voci:', stazionamenti.length);
for (const s of stazionamenti.slice(0, 8)) {
  console.log(`  • ${s.nome} (${s.tipo_stazionamento || '—'})`);
}
if (stazionamenti.length > 8) console.log(`  … +${stazionamenti.length - 8} altre`);
