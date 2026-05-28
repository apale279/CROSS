import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = (await import('module')).createRequire(import.meta.url);
const admin = require('firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = readFileSync(envPath, 'utf8');
const saMatch = env.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.+)/);
const tenantMatch = env.match(/VITE_TENANT_ID=(.+)/);
if (!saMatch || !tenantMatch) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON or VITE_TENANT_ID in .env.local');
  process.exit(1);
}

const serviceAccount = JSON.parse(saMatch[1]);
const tenantId = tenantMatch[1].trim();

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);

const snap = await ref.get();
if (!snap.exists) {
  console.log('Document does not exist');
  process.exit(1);
}

const data = snap.data();
const keys = Object.keys(data).sort();
console.log('Top-level keys:', keys.join(', '));
console.log('tipiEvento:', JSON.stringify(data.tipiEvento));
console.log('tipiLuogo:', JSON.stringify(data.tipiLuogo));
console.log('listaOspedali count:', Array.isArray(data.listaOspedali) ? data.listaOspedali.length : data.listaOspedali);
console.log('pma count:', Array.isArray(data.pma) ? data.pma.length : data.pma);
console.log('stazionamenti count:', Array.isArray(data.stazionamenti) ? data.stazionamenti.length : data.stazionamenti);
console.log('dettagliPerTipoLuogo keys:', data.dettagliPerTipoLuogo ? Object.keys(data.dettagliPerTipoLuogo) : null);
console.log('dettagliPerTipoEvento keys:', data.dettagliPerTipoEvento ? Object.keys(data.dettagliPerTipoEvento) : null);
console.log('pmaClinica keys:', data.pmaClinica ? Object.keys(data.pmaClinica) : null);
console.log('updateTime:', snap.updateTime?.toDate?.()?.toISOString?.());
