/**
 * Crea tenant sandbox Firestore (root indipendente sotto manifestazioni/{id}).
 * Copia impostazioni + mezzi dal tenant sorgente (default: VITE_TENANT_ID in .env.local).
 * Telegram disattivato in impostazioni; nessuna modifica al tenant sorgente.
 *
 *   node scripts/create-sandbox-tenant.mjs
 *   node scripts/create-sandbox-tenant.mjs --source Lr4XjZMr4UWWJWD2m0iW
 */

import { createRequire } from 'module';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FieldValue } from 'firebase-admin/firestore';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SANDBOX_DIR = join(ROOT, 'sandbox');

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

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i + 1 >= process.argv.length) return '';
  return process.argv[i + 1].trim();
}

const ENV = parseEnvFile(join(ROOT, '.env.local'));
const sourceFromArg = argValue('--source');

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
  console.error('\n❌  Nessun service account (.env.local o JSON in root)\n');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const COPY_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_CLOUDINARY_CLOUD_NAME',
  'VITE_CLOUDINARY_UPLOAD_PRESET',
  'VITE_SUPERADMIN',
];

function stripTelegramFromImpostazioni(data) {
  const out = { ...data };
  out.telegramBotEnabled = false;
  out.telegramGpsTrackingEnabled = false;
  out.telegramPasswordEpoch = 0;
  delete out.telegramPasswordHash;
  delete out.telegramPasswordSalt;
  return out;
}

async function resolveSourceTenantId() {
  const fromEnv = (ENV.VITE_TENANT_ID ?? '').trim();
  const source = sourceFromArg || fromEnv;
  if (!source) {
    throw new Error('Tenant sorgente mancante: --source <id> oppure VITE_TENANT_ID in .env.local');
  }
  const snap = await db.collection('manifestazioni').doc(source).get();
  if (!snap.exists) {
    throw new Error(`Tenant sorgente inesistente: ${source}`);
  }
  return source;
}

async function copyMezzi(sourceId, targetId) {
  const src = db.collection('manifestazioni').doc(sourceId).collection('mezzi');
  const snap = await src.get();
  if (snap.empty) return 0;
  let batch = db.batch();
  let ops = 0;
  const commit = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };
  for (const d of snap.docs) {
    const dest = db.collection('manifestazioni').doc(targetId).collection('mezzi').doc(d.id);
    const { manifestationId: _m, ...rest } = d.data();
    batch.set(dest, { ...rest, manifestationId: targetId });
    ops += 1;
    if (ops >= 400) await commit();
  }
  await commit();
  return snap.size;
}

async function verifyTenant(tenantId) {
  const base = db.collection('manifestazioni').doc(tenantId);
  const [man, imp, mezzi, eventi, missioni, pazienti, cont] = await Promise.all([
    base.get(),
    base.collection('settings').doc('impostazioni').get(),
    base.collection('mezzi').get(),
    base.collection('eventi').get(),
    base.collection('missioni').get(),
    base.collection('pazienti').get(),
    base.collection('settings').doc('contatori').get(),
  ]);
  return {
    manifestazione: man.exists,
    impostazioni: imp.exists,
    telegramOff: imp.exists ? imp.data()?.telegramBotEnabled === false : false,
    mezzi: mezzi.size,
    eventi: eventi.size,
    missioni: missioni.size,
    pazienti: pazienti.size,
    contatori: cont.exists ? cont.data() : null,
    pmaCount: (imp.data()?.pma ?? []).length,
    ospedali: (imp.data()?.listaOspedali ?? []).length,
  };
}

function writeSandboxEnvFiles(tenantId, sourceId) {
  mkdirSync(SANDBOX_DIR, { recursive: true });
  const lines = [
    '# Generato da scripts/create-sandbox-tenant.mjs — NON usare per produzione',
    `# Copia da tenant: ${sourceId}`,
    `VITE_TENANT_ID=${tenantId}`,
    '',
    '# Telegram disabilitato in sandbox (non impostare TELEGRAM_TENANT_ID / TELEGRAM_BOT_TOKEN qui)',
    '',
  ];
  for (const key of COPY_ENV_KEYS) {
    if (ENV[key]) lines.push(`${key}=${ENV[key]}`);
  }
  lines.push('VITE_APP_SANDBOX=true');
  lines.push(`VITE_PRODUCTION_TENANT_ID=${sourceId}`);
  lines.push('');
  lines.push('# Non usare VITE_API_BASE_URL verso produzione — le API restano sullo stesso host del deploy sandbox.');
  writeFileSync(join(SANDBOX_DIR, '.env.sandbox.local'), `${lines.join('\n')}\n`, 'utf8');
  writeFileSync(join(SANDBOX_DIR, 'TENANT_ID'), `${tenantId}\n`, 'utf8');
}

async function main() {
  const sourceId = await resolveSourceTenantId();
  console.log(`\n📋  Tenant sorgente (solo lettura): ${sourceId}`);

  const sourceMan = await db.collection('manifestazioni').doc(sourceId).get();
  const sourceName = sourceMan.data()?.nome ?? sourceId;

  const sandboxRef = await db.collection('manifestazioni').add({
    nome: `SANDBOX — copia da ${sourceName}`,
    luogo: 'Ambiente di prova (isolato)',
    creatoIl: FieldValue.serverTimestamp(),
    sandbox: true,
    sandboxSourceTenantId: sourceId,
    sandboxCreatedAt: FieldValue.serverTimestamp(),
  });
  const sandboxId = sandboxRef.id;
  console.log(`✅  Nuovo tenant sandbox: ${sandboxId}`);

  const impSrc = await db
    .collection('manifestazioni')
    .doc(sourceId)
    .collection('settings')
    .doc('impostazioni')
    .get();

  const impData = impSrc.exists
    ? stripTelegramFromImpostazioni(impSrc.data())
    : {
        tipiEvento: ['Trauma', 'Malore', 'Intossicazione', 'Parto', 'Altro'],
        telegramBotEnabled: false,
      };

  await db
    .collection('manifestazioni')
    .doc(sandboxId)
    .collection('settings')
    .doc('impostazioni')
    .set({
      ...impData,
      manifestationId: sandboxId,
      nomeManifestazione: `SANDBOX (${sourceName})`,
    });

  await db
    .collection('manifestazioni')
    .doc(sandboxId)
    .collection('settings')
    .doc('contatori')
    .set({ eventi: 0, missioni: 0, pazienti: 0 });

  const nMezzi = await copyMezzi(sourceId, sandboxId);
  console.log(`   Mezzi copiati: ${nMezzi}`);
  console.log('   Contatori E/M/P: 0');
  console.log('   Telegram in impostazioni: OFF');

  writeSandboxEnvFiles(sandboxId, sourceId);

  const v = await verifyTenant(sandboxId);
  if (!v.manifestazione || !v.impostazioni || !v.telegramOff) {
    throw new Error(`Verifica fallita: ${JSON.stringify(v)}`);
  }

  console.log('\n✅  Verifica OK');
  console.log(`   PMA in impostazioni: ${v.pmaCount}`);
  console.log(`   Ospedali in lista: ${v.ospedali}`);
  console.log(`   Eventi/missioni/pazienti: ${v.eventi}/${v.missioni}/${v.pazienti} (vuoti)`);
  console.log('\n📁  File locali (gitignored .env):');
  console.log(`   sandbox/TENANT_ID`);
  console.log(`   sandbox/.env.sandbox.local`);
  console.log('\n   Dev sandbox: npm run dev:sandbox  →  http://localhost:5321/');
  console.log('\n⚠️  Produzione invariata: VITE_TENANT_ID in .env.local / Vercel prod non toccati.\n');
}

main().catch((err) => {
  console.error('\n❌', err.message);
  console.error(err.stack);
  process.exit(1);
});
