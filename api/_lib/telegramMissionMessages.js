import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.js';

function missioniCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('missioni');
}

/** Estrae coppie { chatId, messageId } da un documento missione. */
export function extractTelegramMessagesFromMission(data) {
  if (!data || typeof data !== 'object') return [];

  const out = [];
  const push = (chatId, messageId) => {
    const c = Number(chatId);
    const m = Number(messageId);
    if (Number.isFinite(c) && Number.isFinite(m)) {
      out.push({ chatId: c, messageId: m });
    }
  };

  if (Array.isArray(data.telegramMessages)) {
    for (const row of data.telegramMessages) {
      push(row?.chatId ?? row?.telegram_chat_id, row?.messageId ?? row?.telegram_msg_id);
    }
  }

  push(data.telegram_chat_id, data.telegram_msg_id);

  if (Array.isArray(data.telegramOutbound)) {
    for (const row of data.telegramOutbound) {
      push(row?.chatId, row?.messageId);
    }
  }

  const seen = new Set();
  return out.filter(({ chatId, messageId }) => {
    const key = `${chatId}:${messageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function appendMissionTelegramMessage(tenantId, missionDocId, chatId, messageId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;

  const c = Number(chatId);
  const m = Number(messageId);
  if (!Number.isFinite(c) || !Number.isFinite(m)) return;

  const ref = missioniCol(tenantId).doc(id);
  await ref.set(
    {
      telegramMessages: FieldValue.arrayUnion({ chatId: c, messageId: m }),
      telegram_chat_id: c,
      telegram_msg_id: m,
    },
    { merge: true },
  );
}

export async function clearMissionTelegramMessages(tenantId, missionDocId) {
  const ref = missioniCol(tenantId).doc(missionDocId);
  await ref.set(
    {
      telegramMessages: FieldValue.delete(),
      telegram_chat_id: FieldValue.delete(),
      telegram_msg_id: FieldValue.delete(),
      telegramOutbound: FieldValue.delete(),
    },
    { merge: true },
  );
}

export async function listMissionsWithTelegramMessages(tenantId) {
  const snap = await missioniCol(tenantId).get();
  return snap.docs
    .map((d) => {
      const data = d.data();
      const messages = extractTelegramMessagesFromMission(data);
      if (!messages.length) return null;
      return { missionDocId: d.id, data, messages };
    })
    .filter(Boolean);
}
