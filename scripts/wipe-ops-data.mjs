/**
 * CROSS — Cancella dati operativi Firebase (eventi, missioni, pazienti).
 * Usa le stesse credenziali di scripts/export-firebase.mjs (.env.local).
 *
 *   node scripts/wipe-ops-data.mjs
 *   node scripts/wipe-ops-data.mjs --include-mezzi
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const raw of readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const ENV = parseEnvFile(join(ROOT, '.env.local'));
const includeMezzi = process.argv.includes('--include-mezzi');

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('\n❌  firebase-admin non trovato. Esegui: npm install\n');
  process.exit(1);
}

let serviceAccount;
if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    console.error('❌  FIREBASE_SERVICE_ACCOUNT_JSON non valido:', e.message);
    process.exit(1);
  }
}

if (!serviceAccount) {
  const candidates = require('fs')
    .readdirSync(ROOT)
    .filter((f) => f.includes('firebase-adminsdk') && f.endsWith('.json'))
    .map((f) => join(ROOT, f));
  for (const p of candidates) {
    if (existsSync(p)) {
      serviceAccount = JSON.parse(readFileSync(p, 'utf8'));
      break;
    }
  }
}

if (!serviceAccount) {
  console.error('\n❌  Nessun service account trovato (.env.local o JSON in root)\n');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function flushBatchDeletes(refs) {
  if (!refs.length) return;
  let batch = db.batch();
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (const ref of refs) {
    batch.delete(ref);
    ops += 1;
    if (ops >= 450) await commit();
  }
  await commit();
}

async function deleteSubcollection(parentRef, subName) {
  const snap = await parentRef.collection(subName).get();
  if (snap.empty) return 0;
  await flushBatchDeletes(snap.docs.map((d) => d.ref));
  return snap.size;
}

async function deletePazienteCascade(tenantId, docId) {
  const ref = db.collection('manifestazioni').doc(tenantId).collection('pazienti').doc(docId);
  let n = 0;
  n += await deleteSubcollection(ref, 'valutazioniSoccorso');
  const pmaSnap = await ref.collection('pmaPresence').get();
  for (const d of pmaSnap.docs) {
    const inner = await d.ref.listCollections();
    for (const col of inner) {
      const innerSnap = await col.get();
      await flushBatchDeletes(innerSnap.docs.map((x) => x.ref));
      n += innerSnap.size;
    }
    await d.ref.delete();
    n += 1;
  }
  await ref.delete();
  return n + 1;
}

async function selectTenant() {
  const tenantEnv = (ENV.VITE_TENANT_ID || '').trim();
  if (tenantEnv) {
    const doc = await db.collection('manifestazioni').doc(tenantEnv).get();
    if (doc.exists) return tenantEnv;
  }
  const snap = await db.collection('manifestazioni').get();
  if (snap.empty) {
    console.error('❌  Nessun documento in /manifestazioni');
    process.exit(1);
  }
  if (snap.size === 1) return snap.docs[0].id;
  console.error('❌  Più manifestazioni: imposta VITE_TENANT_ID in .env.local');
  process.exit(1);
}

async function main() {
  const tenantId = await selectTenant();
  console.log(`\n🗑️  Wipe dati operativi — tenant ${tenantId}`);
  if (includeMezzi) console.log('   (include mezzi)\n');
  else console.log('   (eventi + missioni + pazienti; mezzi NON toccati)\n');

  const pazCol = db.collection('manifestazioni').doc(tenantId).collection('pazienti');
  const pazSnap = await pazCol.get();
  console.log(`   Pazienti da eliminare: ${pazSnap.size}`);
  for (const d of pazSnap.docs) {
    await deletePazienteCascade(tenantId, d.id);
  }

  const misCol = db.collection('manifestazioni').doc(tenantId).collection('missioni');
  const misSnap = await misCol.get();
  await flushBatchDeletes(misSnap.docs.map((d) => d.ref));
  console.log(`   Missioni eliminate: ${misSnap.size}`);

  const evCol = db.collection('manifestazioni').doc(tenantId).collection('eventi');
  const evSnap = await evCol.get();
  await flushBatchDeletes(evSnap.docs.map((d) => d.ref));
  console.log(`   Eventi eliminati: ${evSnap.size}`);

  if (includeMezzi) {
    const mezCol = db.collection('manifestazioni').doc(tenantId).collection('mezzi');
    const mezSnap = await mezCol.get();
    await flushBatchDeletes(mezSnap.docs.map((d) => d.ref));
    console.log(`   Mezzi eliminati: ${mezSnap.size}`);
  }

  const contatoriRef = db
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('settings')
    .doc('contatori');
  await contatoriRef.set({ eventi: 0, missioni: 0, pazienti: 0 }, { merge: true });
  console.log('   Contatori E/M/P azzerati (settings/contatori)');

  console.log('\n✅  Database operativo azzerato.\n');
}

main().catch((err) => {
  console.error('\n❌  Errore:', err.message);
  console.error(err.stack);
  process.exit(1);
});
