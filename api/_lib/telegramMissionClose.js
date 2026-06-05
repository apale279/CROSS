import { editMessageReplyMarkup } from './telegramApi.js';
import { forEachRateLimited } from './telegramRateLimit.js';
import { extractTelegramMessagesFromMission } from './telegramMissionMessages.js';

function isBenignEditError(message) {
  const m = String(message ?? '').toLowerCase();
  return (
    m.includes('message is not modified') ||
    m.includes('message to edit not found') ||
    m.includes("message can't be edited") ||
    m.includes('bad request: message')
  );
}

/** Rimuove i pulsanti inline da un messaggio Telegram (idempotente). */
export async function stripTelegramInlineKeyboard(chatId, messageId) {
  try {
    await editMessageReplyMarkup(chatId, messageId, { inline_keyboard: [] });
    return { ok: true };
  } catch (e) {
    if (isBenignEditError(e.message)) return { ok: false, skipped: true };
    throw e;
  }
}

function dedupeMessages(rows) {
  const seen = new Set();
  return rows.filter(({ chatId, messageId }) => {
    const key = `${chatId}:${messageId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Disattiva tutti i pulsanti stato tracciati sulla missione (+ messaggio callback opzionale).
 */
export async function sealMissionTelegramMessages(missionData, extraMessages = []) {
  const tracked = extractTelegramMessagesFromMission(missionData);
  const targets = dedupeMessages([
    ...tracked,
    ...extraMessages
      .map((row) => ({
        chatId: Number(row?.chatId),
        messageId: Number(row?.messageId),
      }))
      .filter((row) => Number.isFinite(row.chatId) && Number.isFinite(row.messageId)),
  ]);

  let stripped = 0;
  let skipped = 0;

  await forEachRateLimited(targets, async ({ chatId, messageId }) => {
    const result = await stripTelegramInlineKeyboard(chatId, messageId);
    if (result.ok) stripped += 1;
    else skipped += 1;
  });

  return { targeted: targets.length, stripped, skipped };
}

export function callbackQueryMessageRef(callbackQuery) {
  const chatId = callbackQuery?.message?.chat?.id;
  const messageId = callbackQuery?.message?.message_id;
  if (chatId == null || messageId == null) return null;
  return { chatId: Number(chatId), messageId: Number(messageId) };
}

export async function stripCallbackQueryKeyboard(callbackQuery) {
  const ref = callbackQueryMessageRef(callbackQuery);
  if (!ref) return { targeted: 0, stripped: 0, skipped: 0 };
  return sealMissionTelegramMessages({}, [ref]);
}
