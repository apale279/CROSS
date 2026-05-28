import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = (await import('module')).createRequire(import.meta.url);
const admin = require('firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const serviceAccount = JSON.parse(env.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.+)/)[1]);
const tenantId = env.match(/VITE_TENANT_ID=(.+)/)[1].trim();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);
const snap = await ref.get();
const current = snap.data();

const snapshotPath = join(
  __dirname,
  '..',
  'Datiexport_local',
  'impostazioni-snapshots',
  'impostazioni_2026-05-28T14-00-00-000Z.json',
);
const before = JSON.parse(readFileSync(snapshotPath, 'utf8'));

function summarize(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log('keys:', Object.keys(data).sort().join(', '));
  console.log('tipiLuogo:', data.tipiLuogo?.length ?? 'MISSING');
  console.log('dettagliPerTipoLuogo keys:', Object.keys(data.dettagliPerTipoLuogo ?? {}).length);
  console.log('listaOspedali:', data.listaOspedali?.length ?? 'MISSING');
  console.log('stazionamenti:', data.stazionamenti?.length ?? 'MISSING');
  console.log('pma:', data.pma?.length ?? 'MISSING');
  console.log('luogo_fisico:', data.luogo_fisico === undefined ? 'MISSING' : JSON.stringify(data.luogo_fisico));
  console.log('guida_pdf_url:', data.guida_pdf_url === undefined ? 'MISSING' : 'set');
  console.log('mappaDashboardDefault:', data.mappaDashboardDefault === undefined ? 'MISSING' : 'set');
  console.log('telegramGpsTrackingEnabled:', data.telegramGpsTrackingEnabled);
}

summarize('BEFORE (14:00 snapshot)', before);
summarize('CURRENT', current);

const missingKeys = Object.keys(before).filter((k) => current[k] === undefined);
const emptyArrays = Object.keys(before).filter(
  (k) => Array.isArray(before[k]) && Array.isArray(current[k]) && current[k].length === 0 && before[k].length > 0,
);
console.log('\nMissing top-level keys in current:', missingKeys);
console.log('Emptied arrays:', emptyArrays);
