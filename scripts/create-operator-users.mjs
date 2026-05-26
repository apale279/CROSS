#!/usr/bin/env node
/**
 * Crea o ricrea account Auth + profilo Firestore.
 *
 *   node --env-file=.env.local scripts/create-operator-users.mjs
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const envPath = new URL('../.env.local', import.meta.url);
const raw = readFileSync(envPath, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const tenantId = env.VITE_TENANT_ID || env.TELEGRAM_TENANT_ID;

const USERS = [
  {
    email: 'admin@admin.it',
    password: 'admin.admin',
    nome: 'Amministratore',
    nomeUtente: 'admin',
    accessType: 'CENTRALE',
    pmaRank: '',
    pmaScopeId: '',
  },
  {
    email: 'andrea@medico.it',
    password: 'Bicocca2027!',
    nome: 'Andrea Paleari',
    nomeUtente: 'andrea.paleari.doc',
    accessType: 'CENTRALE',
    pmaRank: 'MEDICO',
    pmaScopeId: '',
  },
];

if (!tenantId) {
  console.error('Manca VITE_TENANT_ID in .env.local');
  process.exit(1);
}

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!getApps().length) {
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const auth = getAuth();
const db = getFirestore();

async function deleteByEmail(targetEmail) {
  let uid = null;
  try {
    const record = await auth.getUserByEmail(targetEmail);
    uid = record.uid;
    await auth.deleteUser(uid);
    console.log('  Auth eliminato:', uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    console.log('  Nessun account Auth precedente');
  }

  if (uid) {
    const profileRef = db.doc(`manifestazioni/${tenantId}/userProfiles/${uid}`);
    const snap = await profileRef.get();
    if (snap.exists) {
      await profileRef.delete();
      console.log('  Profilo eliminato:', uid);
    }
  }

  const orphanSnap = await db
    .collection(`manifestazioni/${tenantId}/userProfiles`)
    .where('email', '==', targetEmail)
    .get();
  for (const doc of orphanSnap.docs) {
    await doc.ref.delete();
    console.log('  Profilo orfano eliminato:', doc.id);
  }
}

async function createUser(u) {
  console.log(`\n--- ${u.email} ---`);
  await deleteByEmail(u.email);

  const userRecord = await auth.createUser({
    email: u.email,
    password: u.password,
    displayName: u.nome,
  });

  await db.doc(`manifestazioni/${tenantId}/userProfiles/${userRecord.uid}`).set({
    email: u.email,
    nome: u.nome,
    nomeUtente: u.nomeUtente,
    accessType: u.accessType,
    pmaRank: u.pmaRank,
    pmaScopeId: u.pmaScopeId,
    creatoIl: FieldValue.serverTimestamp(),
  });

  console.log('  Creato uid:', userRecord.uid);
  console.log('  accessType:', u.accessType, u.pmaRank ? `pmaRank=${u.pmaRank}` : '');
  console.log('  nome:', u.nome, '| nomeUtente:', u.nomeUtente);
}

console.log('Tenant:', tenantId);
for (const u of USERS) {
  await createUser(u);
}
console.log('\n=== Completato ===');
