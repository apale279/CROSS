import { getAdminDb } from './firebaseAdmin.js';
import { deleteMessage, sendMessage } from './telegramApi.js';
import { forEachRateLimited } from './telegramRateLimit.js';
import { telegramUsersCollection } from './telegramFirestore.js';
import {
  clearMissionTelegramMessages,
  extractTelegramMessagesFromMission,
  listMissionsWithTelegramMessages,
} from './telegramMissionMessages.js';

const FINAL_MESSAGE =
  'Sessione conclusa. Tutti i dati sensibili sono stati rimossi dal dispositivo.';

function isBenignDeleteError(message) {
  const m = String(message ?? '').toLowerCase();
  return (
    m.includes("message can't be deleted") ||
    m.includes('message to delete not found') ||
    m.includes('message identifier is not specified') ||
    m.includes('bad request: message')
  );
}

export async function wipeTelegramForTenant(tenantId) {
  const missions = await listMissionsWithTelegramMessages(tenantId);

  const deleteTargets = [];
  const chatIds = new Set();

  for (const row of missions) {
    for (const { chatId, messageId } of row.messages) {
      deleteTargets.push({ missionDocId: row.missionDocId, chatId, messageId });
      chatIds.add(chatId);
    }
  }

  let deleted = 0;
  let deleteErrors = 0;

  await forEachRateLimited(deleteTargets, async ({ chatId, messageId }) => {
    try {
      await deleteMessage(chatId, messageId);
      deleted += 1;
    } catch (e) {
      if (!isBenignDeleteError(e.message)) {
        deleteErrors += 1;
        console.warn('[telegram-wipe] deleteMessage', chatId, messageId, e.message);
      }
    }
  });

  const clearedMissionIds = new Set(missions.map((m) => m.missionDocId));
  for (const missionDocId of clearedMissionIds) {
    await clearMissionTelegramMessages(tenantId, missionDocId);
  }

  let notified = 0;
  let notifyErrors = 0;

  await forEachRateLimited([...chatIds], async (chatId) => {
    try {
      await sendMessage(chatId, FINAL_MESSAGE);
      notified += 1;
    } catch (e) {
      notifyErrors += 1;
      console.warn('[telegram-wipe] sendMessage', chatId, e.message);
    }
  });

  const usersSnap = await telegramUsersCollection(tenantId).get();
  let telegramUsersDeleted = 0;

  if (!usersSnap.empty) {
    const batchSize = 400;
    const docs = usersSnap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = getAdminDb().batch();
      for (const d of docs.slice(i, i + batchSize)) {
        batch.delete(d.ref);
        telegramUsersDeleted += 1;
      }
      await batch.commit();
    }
  }

  return {
    missionsScanned: missions.length,
    messagesTargeted: deleteTargets.length,
    messagesDeleted: deleted,
    deleteErrors,
    chatsNotified: notified,
    notifyErrors,
    telegramUsersDeleted,
  };
}

/** Per test / ispezione senza cancellare. */
export function countTelegramArtifacts(tenantId) {
  return listMissionsWithTelegramMessages(tenantId).then((rows) => {
    let messages = 0;
    const chats = new Set();
    for (const row of rows) {
      for (const msg of row.messages) {
        messages += 1;
        chats.add(msg.chatId);
      }
    }
    return { missions: rows.length, messages, chats: chats.size };
  });
}

export { extractTelegramMessagesFromMission };
