import { getTelegramAuthSettings, telegramUsersCollection } from './telegramFirestore.js';

/** Equipaggio con mezzo assegnato e sessione bot valida. */
export async function listTelegramUsersLoggedIn(tenantId) {
  const settings = await getTelegramAuthSettings(tenantId);
  const snap = await telegramUsersCollection(tenantId).get();

  return snap.docs
    .map((d) => {
      const data = d.data();
      return {
        chatId: data.chatId ?? Number(d.id),
        mezzo: String(data.mezzo ?? '').trim(),
        firstName: String(data.firstName ?? '').trim(),
        username: String(data.username ?? '').trim(),
        awaitingPassword: data.awaitingPassword === true,
        passwordEpoch: Number(data.passwordEpoch ?? 0),
      };
    })
    .filter((u) => {
      if (!u.mezzo) return false;
      if (u.awaitingPassword) return false;
      if (settings.required) {
        return u.passwordEpoch === settings.epoch;
      }
      return true;
    })
    .sort((a, b) => a.mezzo.localeCompare(b.mezzo, 'it', { sensitivity: 'base' }));
}

export async function listTelegramLoggedInChatIds(tenantId) {
  const users = await listTelegramUsersLoggedIn(tenantId);
  return users.map((u) => u.chatId).filter((id) => id != null);
}
