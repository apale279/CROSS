import { FieldValue, getAdminDb } from './firebaseAdmin.js';
import { escapeHtml, sendMessage } from './telegramApi.js';
import { buildEquipaggioReplyKeyboard } from './telegramKeyboard.js';
import { ensureAuthenticatedOrPrompt } from './telegramAuth.js';
import { getTelegramAuthSettings, getTelegramUser } from './telegramFirestore.js';

function sosAlertsCol(tenantId) {
  return getAdminDb().collection('manifestazioni').doc(tenantId).collection('sos_alerts');
}

export function isSosTelegramText(text) {
  const t = (text ?? '').trim();
  if (!t) return false;
  return (
    /^\/sos(\s|$|@)/i.test(t) ||
    /^🚨/u.test(t) ||
    /^sos$/i.test(t) ||
    /emergenza/i.test(t)
  );
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

  await sosAlertsCol(tenantId).add({
    mezzo,
    chatId: Number(chatId),
    firstName: from?.first_name ?? '',
    username: from?.username ?? '',
    acknowledged: false,
    creatoIl: FieldValue.serverTimestamp(),
  });

  await sendMessage(
    chatId,
    `🚨 <b>Allarme inviato alla centrale operativa</b>\n\nMezzo: <b>${escapeHtml(mezzo)}</b>\nLa centrale è stata avvisata.`,
    { reply_markup: buildEquipaggioReplyKeyboard() },
  );

  return { ok: true, mezzo };
}
