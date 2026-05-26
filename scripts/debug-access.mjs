#!/usr/bin/env node
/**
 * Debug accessi PMA: legge userProfiles da Firestore.
 * node --env-file=.env.local scripts/debug-access.mjs [uid]
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

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
const uidArg = process.argv[2]?.trim();

if (!tenantId) {
  console.error('Manca VITE_TENANT_ID');
  process.exit(1);
}

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!getApps().length) {
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const db = getFirestore();
const auth = getAuth();

console.log('=== CROSS debug accessi ===');
console.log('tenantId:', tenantId);
console.log('VITE_SUPERADMIN (.env.local):', env.VITE_SUPERADMIN ?? '(unset)');
console.log('(Nota: superadmin env NON deve più aprire menu centrale a tutti)\n');

const profilesSnap = await db.collection(`manifestazioni/${tenantId}/userProfiles`).get();
console.log(`Profili utente (${profilesSnap.size}):`);
for (const doc of profilesSnap.docs) {
  const d = doc.data();
  let email = d.email ?? '';
  try {
    const au = await auth.getUser(doc.id);
    email = au.email ?? email;
  } catch {
    /* orphan */
  }
  const line = {
    uid: doc.id,
    email,
    accessType: d.accessType ?? '(assente)',
    pmaRank: d.pmaRank ?? '(assente)',
    pmaScopeId: d.pmaScopeId ?? '(assente)',
    nome: d.nome ?? '',
  };
  console.log(JSON.stringify(line));
}

if (uidArg) {
  const snap = await db.doc(`manifestazioni/${tenantId}/userProfiles/${uidArg}`).get();
  console.log('\n--- Dettaglio uid', uidArg, '---');
  if (!snap.exists) {
    console.log('PROFILO NON TROVATO su Firestore');
  } else {
    const d = snap.data();
    console.log(JSON.stringify(d, null, 2));
  }
}
