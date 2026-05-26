#!/usr/bin/env node
/**
 * Elimina e ricrea un account centrale (Auth + profilo Firestore).
 *
 *   node --env-file=.env.local scripts/rebootstrap-centrale-user.mjs
 *
 * Richiede env:
 *   CROSS_BOOTSTRAP_EMAIL
 *   CROSS_BOOTSTRAP_PASSWORD  (min 6 caratteri)
 *   CROSS_BOOTSTRAP_NOME      (opzionale)
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
const email = String(process.env.CROSS_BOOTSTRAP_EMAIL ?? '').trim().toLowerCase();
const password = String(process.env.CROSS_BOOTSTRAP_PASSWORD ?? '');
const nome = String(process.env.CROSS_BOOTSTRAP_NOME ?? 'Amministratore centrale').trim();

if (!tenantId) {
  console.error('Manca VITE_TENANT_ID in .env.local');
  process.exit(1);
}
if (!email || !password || password.length < 6) {
  console.error('Imposta CROSS_BOOTSTRAP_EMAIL e CROSS_BOOTSTRAP_PASSWORD (min 6 caratteri).');
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
    console.log('Auth eliminato:', uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    console.log('Nessun account Auth per', targetEmail);
  }

  if (uid) {
    const profileRef = db.doc(`manifestazioni/${tenantId}/userProfiles/${uid}`);
    const snap = await profileRef.get();
    if (snap.exists) {
      await profileRef.delete();
      console.log('Profilo Firestore eliminato:', uid);
    }
  }

  const orphanSnap = await db
    .collection(`manifestazioni/${tenantId}/userProfiles`)
    .where('email', '==', targetEmail)
    .get();
  for (const doc of orphanSnap.docs) {
    await doc.ref.delete();
    console.log('Profilo orfano eliminato:', doc.id);
  }
}

await deleteByEmail(email);

const userRecord = await auth.createUser({
  email,
  password,
  displayName: nome,
});

const profileRef = db.doc(`manifestazioni/${tenantId}/userProfiles/${userRecord.uid}`);
await profileRef.set({
  email,
  nome,
  nomeUtente: '',
  accessType: 'CENTRALE',
  pmaRank: '',
  pmaScopeId: '',
  creatoIl: FieldValue.serverTimestamp(),
});

console.log('\n=== Account centrale creato ===');
console.log('uid:', userRecord.uid);
console.log('email:', email);
console.log('accessType: CENTRALE');
console.log('tenantId:', tenantId);
