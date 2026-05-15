import { initializeApp } from 'firebase/app';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
} from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const path = resolve(process.cwd(), '.env.local');
  const text = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

const env = loadEnv();
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

async function countCol(pathSegments) {
  const snap = await getDocs(query(collection(db, ...pathSegments), limit(100)));
  return snap.size;
}

async function main() {
  console.log('Project:', env.VITE_FIREBASE_PROJECT_ID);

  const manSnap = await getDocs(query(collection(db, 'manifestazioni'), limit(20)));
  console.log('\nmanifestazioni:', manSnap.size, 'documenti');
  for (const d of manSnap.docs) {
    const data = d.data();
    console.log(' -', d.id, '|', data.nome ?? '(senza nome)');

    const nested = {
      eventi: await countCol(['manifestazioni', d.id, 'eventi']),
      missioni: await countCol(['manifestazioni', d.id, 'missioni']),
      mezzi: await countCol(['manifestazioni', d.id, 'mezzi']),
      pazienti: await countCol(['manifestazioni', d.id, 'pazienti']),
    };
    console.log('   nested:', nested);

    const impRef = doc(db, 'manifestazioni', d.id, 'settings', 'impostazioni');
    const impSnap = await getDoc(impRef);
    console.log('   impostazioni (nested):', impSnap.exists() ? 'OK' : 'ASSENTE');

    const impRoot = await getDoc(doc(db, 'impostazioni', d.id));
    console.log('   impostazioni (root):', impRoot.exists() ? 'OK' : 'assente');
  }

  const rootCols = ['eventi', 'missioni', 'mezzi', 'pazienti', 'impostazioni'];
  console.log('\nCollezioni root (flat):');
  for (const name of rootCols) {
    const n = await countCol([name]);
    console.log(` - ${name}:`, n, 'doc (max 100 campione)');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRORE:', err.code ?? err.message);
  console.error(err);
  process.exit(1);
});
