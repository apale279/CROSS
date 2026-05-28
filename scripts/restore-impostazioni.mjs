import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = (await import('module')).createRequire(import.meta.url);
const admin = require('firebase-admin');
const { FieldPath } = require('firebase-admin/firestore');

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const serviceAccount = JSON.parse(env.match(/FIREBASE_SERVICE_ACCOUNT_JSON=(.+)/)[1]);
const tenantId = env.match(/VITE_TENANT_ID=(.+)/)[1].trim();

const { DEFAULT_TIPI_LUOGO, DEFAULT_DETTAGLI_PER_TIPO_LUOGO } = await import(
  '../src/data/defaultLuoghiImpostazioni.js'
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);
const snap = await ref.get();
const current = snap.data() ?? {};

const currentDettagli =
  current.dettagliPerTipoLuogo && typeof current.dettagliPerTipoLuogo === 'object'
    ? current.dettagliPerTipoLuogo
    : {};

const mergedDettagli = { ...DEFAULT_DETTAGLI_PER_TIPO_LUOGO, ...currentDettagli };

await ref.update({ tipiLuogo: [...DEFAULT_TIPI_LUOGO] });
console.log('tipiLuogo ripristinati:', DEFAULT_TIPI_LUOGO.length);

let n = 0;
for (const [tipo, list] of Object.entries(mergedDettagli)) {
  await ref.update(new FieldPath('dettagliPerTipoLuogo', tipo), list);
  n += 1;
}
console.log('dettagliPerTipoLuogo ripristinati:', n, 'tipi');

writeFileSync(
  join(__dirname, '..', 'Datiexport_local', 'impostazioni-restore-applied.json'),
  JSON.stringify({ tipiLuogo: DEFAULT_TIPI_LUOGO, dettagliKeys: Object.keys(mergedDettagli) }, null, 2),
);

console.log('Ripristino completato.');
