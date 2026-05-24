import { FieldValue, getAdminDb } from './firebaseAdmin.js';
import { escapeHtml, sendMessage } from './telegramApi.js';
import { buildEquipaggioReplyKeyboard } from './telegramKeyboard.js';
import { ensureAuthenticatedOrPrompt } from './telegramAuth.js';
import {
  getTelegramAuthSettings,
  getTelegramUser,
  telegramUsersCollection,
} from './telegramFirestore.js';

const SOS_COOLDOWN_MS = 60_000;

function sosAlertsCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('sos_alerts');
}

/** Comando esplicito o messaggio solo «SOS» / «🚨» — non parole in frasi libere. */
export function isSosTelegramText(text) {
  const t = (text ?? '').trim();
  if (!t) return false;
  return (
    /^\/sos(\s|$|@)/i.test(t) ||
    /^sos$/i.test(t) ||
    /^🚨$/u.test(t)
  );
}

function lastSosAtMs(user) {
  const raw = user?.lastSosAt;
  if (!raw) return 0;
  if (typeof raw.toMillis === 'function') return raw.toMillis();
  if (typeof raw.seconds === 'number') return raw.seconds * 1000;
  return 0;
}

export async function handleSosCommand(chatId, tenantId, from) {
  const settings = await getTelegramAuthSettings(tenantId);
  const user = await getTelegramUser(tenantId, chatId);

  if (!(await ensureAuthenticatedOrPrompt(chatId, tenantId, settings, user))) {
    return { ok: false, reason: 'auth' };
  }

  const mezzo = (user?.mezzo ?? '').trim();
  if (!mezzo) {
    await sendMessage(
      chatId,
      'Nessun mezzo assegnato. Invia <b>/start</b> e scegli il mezzo prima di usare SOS.',
      { reply_markup: buildEquipaggioReplyKeyboard() },
    );
    return { ok: false, reason: 'no_mezzo' };
  }

  const elapsed = Date.now() - lastSosAtMs(user);
  if (elapsed >= 0 && elapsed < SOS_COOLDOWN_MS) {
    const waitSec = Math.ceil((SOS_COOLDOWN_MS - elapsed) / 1000);
    await sendMessage(
      chatId,
      `⏳ <b>SOS già inviato di recente.</b>\nAttendi ${waitSec} secondi prima di inviarne un altro.`,
      { reply_markup: buildEquipaggioReplyKeyboard() },
    );
    return { ok: false, reason: 'cooldown' };
  }

  await sosAlertsCol(tenantId).add({
    mezzo,
    chatId: Number(chatId),
    firstName: from?.first_name ?? '',
    username: from?.username ?? '',
    acknowledged: false,
    creatoIl: FieldValue.serverTimestamp(),
  });

  await telegramUsersCollection(tenantId)
    .doc(String(chatId))
    .set({ lastSosAt: FieldValue.serverTimestamp() }, { merge: true });

  await sendMessage(
    chatId,
    `🚨 <b>Allarme inviato alla centrale operativa</b>\n\nMezzo: <b>${escapeHtml(mezzo)}</b>\nLa centrale è stata avvisata.`,
    { reply_markup: buildEquipaggioReplyKeyboard() },
  );

  return { ok: true, mezzo };
}
