import { readFileSync, writeFileSync, mkdirSync } from 'fs';
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

const readTimes = [
  '2026-05-28T11:00:00.000Z',
  '2026-05-28T12:00:00.000Z',
  '2026-05-28T13:00:00.000Z',
  '2026-05-28T14:00:00.000Z',
  '2026-05-28T15:00:00.000Z',
  '2026-05-28T16:00:00.000Z',
  '2026-05-27T20:00:00.000Z',
];

const outDir = join(__dirname, '..', 'Datiexport_local', 'impostazioni-snapshots');
mkdirSync(outDir, { recursive: true });

for (const rt of readTimes) {
  try {
    const snap = await ref.get({
      readTime: admin.firestore.Timestamp.fromDate(new Date(rt)),
    });
    if (!snap.exists) {
      console.log(rt, '— no doc');
      continue;
    }
    const data = snap.data();
    const file = join(outDir, `impostazioni_${rt.replace(/[:.]/g, '-')}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2));
    console.log(
      rt,
      'OK',
      'tipiLuogo:',
      data.tipiLuogo?.length ?? 'missing',
      'dettagliLuogo keys:',
      data.dettagliPerTipoLuogo ? Object.keys(data.dettagliPerTipoLuogo).length : 0,
    );
  } catch (e) {
    console.log(rt, 'ERR', e.message?.slice(0, 120));
  }
}
