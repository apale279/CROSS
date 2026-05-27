#!/usr/bin/env node
/**
 * Importa mezzi dal foglio FLOTTA di «FLOTTA RESEGUP 2026.xlsx».
 * A=sigla, B=tipo mezzo, C=nome stazionamento → indirizzo/coordinate da elenco Impostazioni.
 *
 * Uso:
 *   node --env-file=.env.local scripts/import-mezzi-flotta.mjs
 *   node --env-file=.env.local scripts/import-mezzi-flotta.mjs "Prompt_local/file.xlsx"
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

const { importMezziFromFlottaExcel } = await import(
  pathToFileURL(join(ROOT, 'src/services/mezziImportService.js')).href
);

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
const impRef = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);
const impSnap = await impRef.get();
const imp = impSnap.data() ?? {};
const stazionamenti = imp.stazionamenti ?? [];
const tipiMezzo = imp.tipiMezzo ?? [];

const mezziSnap = await db.collection(`manifestazioni/${tenantId}/mezzi`).get();
const existingMezzi = mezziSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

const buf = readFileSync(excelPath);
const result = await importMezziFromFlottaExcel(tenantId, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), {
  stazionamenti,
  tipiMezzo,
  existingMezzi,
});

console.log('Import mezzi completato');
console.log('Foglio:', result.sheetName);
console.log('Creati:', result.created);
if (result.skipped.length) console.log('Saltati (già presenti):', result.skipped.join(', '));
if (result.tipiAggiunti.length) console.log('Tipi mezzo aggiunti:', result.tipiAggiunti.join(', '));
if (result.missingStazionamenti.length) {
  console.warn('Stazionamenti non trovati in impostazioni:', result.missingStazionamenti.join(', '));
  console.warn('Importa prima gli stazionamenti (npm run import:stazionamenti-flotta).');
}
