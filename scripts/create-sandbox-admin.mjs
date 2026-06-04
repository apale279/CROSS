#!/usr/bin/env node
/**
 * Crea (o ricrea) account centrale admin sul tenant sandbox.
 *
 *   node scripts/create-sandbox-admin.mjs
 *   node scripts/create-sandbox-admin.mjs --email admin.sandbox@admin.it --password admin.sandbox
 */

import { createRequire } from 'module';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FieldValue } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SANDBOX_ENV = join(ROOT, 'sandbox', '.env.sandbox.local');
const TENANT_FILE = join(ROOT, 'sandbox', 'TENANT_ID');

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

function argValue(flag, fallback = '') {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return fallback;
  return process.argv[i + 1].trim();
}

const sandboxEnv = parseEnvFile(SANDBOX_ENV);
const rootEnv = parseEnvFile(join(ROOT, '.env.local'));
const ENV = { ...rootEnv, ...sandboxEnv };

const tenantId =
  (ENV.VITE_TENANT_ID ?? '').trim() ||
  (existsSync(TENANT_FILE) ? readFileSync(TENANT_FILE, 'utf8').trim() : '');

const email = argValue('--email', 'admin.sandbox@admin.it').toLowerCase();
const password = argValue('--password', 'admin.sandbox');
const nome = argValue('--nome', 'Admin Sandbox');

if (!tenantId) {
  console.error('\n❌  Tenant sandbox mancante. Esegui: npm run sandbox:create\n');
  process.exit(1);
}
if (!email || !password || password.length < 6) {
  console.error('\n❌  Email e password (min 6 caratteri) obbligatori.\n');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('\n❌  firebase-admin non trovato.\n');
  process.exit(1);
}

let serviceAccount;
if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
  serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
} else {
  console.error('\n❌  FIREBASE_SERVICE_ACCOUNT_JSON mancante in .env.local\n');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const auth = admin.auth();
const db = admin.firestore();

async function deleteByEmail(targetEmail) {
  try {
    const existing = await auth.getUserByEmail(targetEmail);
    await auth.deleteUser(existing.uid);
    const prof = db.doc(`manifestazioni/${tenantId}/userProfiles/${existing.uid}`);
    if ((await prof.get()).exists) await prof.delete();
    console.log(`   Rimosso account precedente: ${targetEmail}`);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
  }
}

async function main() {
  const man = await db.collection('manifestazioni').doc(tenantId).get();
  if (!man.exists) {
    throw new Error(`Tenant sandbox inesistente: ${tenantId}`);
  }

  console.log(`\n🧪  Tenant sandbox: ${tenantId}`);
  console.log(`   Email admin: ${email}`);

  await deleteByEmail(email);

  const userRecord = await auth.createUser({
    email,
    password,
    displayName: nome,
  });

  await db.doc(`manifestazioni/${tenantId}/userProfiles/${userRecord.uid}`).set({
    email,
    nome,
    nomeUtente: 'admin',
    accessType: 'CENTRALE',
    pmaRank: '',
    pmaScopeId: '',
    canEditImpostazioni: true,
    creatoIl: FieldValue.serverTimestamp(),
  });

  console.log('\n✅  Account admin sandbox creato');
  console.log(`   uid: ${userRecord.uid}`);
  console.log(`   Login: ${email} / ${password}`);
  console.log('\n   Usa il deploy o http://localhost:5321/ con npm run dev:sandbox\n');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  process.exit(1);
});
