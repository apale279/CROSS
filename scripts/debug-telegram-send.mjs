#!/usr/bin/env node
/**
 * Diagnostica invio missioni Telegram (Firestore + findChatIdsByMezzo).
 * node --env-file=.env.local scripts/debug-telegram-send.mjs [SIGLA_MEZZO]
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
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

const tenantId = env.TELEGRAM_TENANT_ID || env.VITE_TENANT_ID;
const mezzoArg = process.argv[2]?.trim();

if (!tenantId) {
  console.error('Manca TELEGRAM_TENANT_ID in .env.local');
  process.exit(1);
}

const sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
if (!getApps().length) {
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
}
const db = getFirestore();

const impSnap = await db
  .doc(`manifestazioni/${tenantId}/settings/impostazioni`)
  .get();
const imp = impSnap.data() ?? {};
console.log('tenantId:', tenantId);
console.log('telegramBotEnabled:', imp.telegramBotEnabled === true);
const epoch = Number(imp.telegramPasswordEpoch ?? 0) || 0;
const pwdRequired = Boolean(imp.telegramBotPasswordSalt && imp.telegramBotPasswordHash);
console.log('passwordRequired:', pwdRequired, 'epoch:', epoch);

const usersSnap = await db.collection(`manifestazioni/${tenantId}/telegram_users`).get();
console.log('\n--- telegram_users ---');
for (const d of usersSnap.docs) {
  const u = d.data();
  const authed = !pwdRequired || Number(u.passwordEpoch) === epoch;
  console.log({
    chatId: u.chatId,
    mezzo: u.mezzo ?? '(nessuno)',
    passwordEpoch: u.passwordEpoch,
    awaitingPassword: u.awaitingPassword,
    authedForSend: authed && Boolean(u.mezzo?.trim()),
  });
}

if (mezzoArg) {
  const matching = usersSnap.docs.filter((d) => d.data().mezzo === mezzoArg);
  const authed = matching.filter((d) => {
    const u = d.data();
    return (!pwdRequired || Number(u.passwordEpoch) === epoch) && u.mezzo?.trim();
  });
  console.log(`\n--- findChatIdsByMezzo("${mezzoArg}") ---`);
  console.log('raw matches:', matching.length, 'authenticated:', authed.length);
  if (!authed.length) {
    console.log(
      'Possibile causa: sigla missione diversa da mezzo Telegram, o password non allineata (/cambiapassword + /start).',
    );
  }
}

const missionsSnap = await db
  .collection(`manifestazioni/${tenantId}/missioni`)
  .where('aperta', '==', true)
  .limit(5)
  .get();
console.log('\n--- missioni aperte (campo mezzo) ---');
for (const d of missionsSnap.docs) {
  const m = d.data();
  console.log({ id: m.idMissione, mezzo: m.mezzo, docId: d.id });
}
