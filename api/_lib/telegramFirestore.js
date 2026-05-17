import { FieldValue, getAdminDb } from './firebaseAdmin.js';
import { hashBotPassword, parseTelegramPasswordSettings } from './telegramPassword.js';

/** `manifestazioni/{tenantId}/telegram_users/{chatId}` */
export function telegramUsersCollection(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('telegram_users');
}

export function impostazioniDocRef(tenantId) {
  return getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('settings')
    .doc('impostazioni');
}

export async function isTelegramBotEnabled(tenantId) {
  const snap = await impostazioniDocRef(tenantId).get();
  if (!snap.exists) return false;
  return snap.data()?.telegramBotEnabled === true;
}

export async function getTelegramAuthSettings(tenantId) {
  const snap = await impostazioniDocRef(tenantId).get();
  return parseTelegramPasswordSettings(snap.exists ? snap.data() : {});
}

export async function setTelegramBotPassword(tenantId, password) {
  const ref = impostazioniDocRef(tenantId);
  const snap = await ref.get();
  const prevEpoch = Number(snap.data()?.telegramPasswordEpoch ?? 0) || 0;

  if (!password) {
    await ref.set(
      {
        telegramBotPasswordSalt: FieldValue.delete(),
        telegramBotPasswordHash: FieldValue.delete(),
        telegramPasswordEpoch: 0,
      },
      { merge: true },
    );
    return { epoch: 0 };
  }

  const { salt, hash } = hashBotPassword(password);
  const epoch = prevEpoch + 1;
  await ref.set(
    {
      telegramBotPasswordSalt: salt,
      telegramBotPasswordHash: hash,
      telegramPasswordEpoch: epoch,
    },
    { merge: true },
  );
  return { epoch, salt, hash };
}

export async function listMezziSigle(tenantId) {
  const snap = await getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('mezzi')
    .get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return (data.sigla ?? d.id ?? '').trim();
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }));
}

export async function getTelegramUser(tenantId, chatId) {
  const snap = await telegramUsersCollection(tenantId).doc(String(chatId)).get();
  return snap.exists ? snap.data() : null;
}

export async function setTelegramUserAwaitingPassword(tenantId, chatId, awaiting) {
  await telegramUsersCollection(tenantId).doc(String(chatId)).set(
    { chatId: Number(chatId), awaitingPassword: awaiting, manifestationId: tenantId },
    { merge: true },
  );
}

/** Solo autenticazione password: rimuove assegnazione mezzo (logout equipaggio). */
export async function setTelegramUserAuthenticated(tenantId, chatId, epoch, profile = {}) {
  await telegramUsersCollection(tenantId).doc(String(chatId)).set(
    {
      chatId: Number(chatId),
      manifestationId: tenantId,
      passwordEpoch: epoch,
      awaitingPassword: false,
      mezzo: FieldValue.delete(),
      firstName: profile.firstName ?? '',
      username: profile.username ?? '',
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Rimuove solo il mezzo (nuova sessione equipaggio, es. /start). */
export async function clearTelegramUserMezzo(tenantId, chatId) {
  await telegramUsersCollection(tenantId).doc(String(chatId)).set(
    {
      chatId: Number(chatId),
      manifestationId: tenantId,
      mezzo: FieldValue.delete(),
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Reset sessione: password + scelta mezzo da rifare. */
export async function resetTelegramUserSession(tenantId, chatId) {
  await telegramUsersCollection(tenantId).doc(String(chatId)).set(
    {
      chatId: Number(chatId),
      manifestationId: tenantId,
      passwordEpoch: 0,
      awaitingPassword: true,
      mezzo: FieldValue.delete(),
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function upsertTelegramUser(tenantId, chatId, mezzo, profile = {}) {
  const ref = telegramUsersCollection(tenantId).doc(String(chatId));
  await ref.set(
    {
      chatId: Number(chatId),
      mezzo,
      manifestationId: tenantId,
      firstName: profile.firstName ?? '',
      username: profile.username ?? '',
      passwordEpoch: profile.passwordEpoch ?? 0,
      awaitingPassword: false,
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function invalidateAllTelegramAuth(tenantId) {
  const snap = await telegramUsersCollection(tenantId).get();
  if (snap.empty) return 0;

  const batch = getAdminDb().batch();
  for (const doc of snap.docs) {
    batch.set(
      doc.ref,
      {
        passwordEpoch: 0,
        awaitingPassword: true,
        mezzo: FieldValue.delete(),
      },
      { merge: true },
    );
  }
  await batch.commit();
  return snap.size;
}

export async function findChatIdsByMezzo(tenantId, mezzo, { authenticatedOnly = false } = {}) {
  const snap = await telegramUsersCollection(tenantId).where('mezzo', '==', mezzo).get();
  if (!authenticatedOnly) {
    return snap.docs.map((d) => d.data().chatId).filter((id) => id != null);
  }

  const settings = await getTelegramAuthSettings(tenantId);
  if (!settings.required) {
    return snap.docs.map((d) => d.data().chatId).filter((id) => id != null);
  }

  return snap.docs
    .filter((d) => {
      const data = d.data();
      return (
        Number(data.passwordEpoch) === settings.epoch &&
        typeof data.mezzo === 'string' &&
        data.mezzo.trim().length > 0
      );
    })
    .map((d) => d.data().chatId)
    .filter((id) => id != null);
}
