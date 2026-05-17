import { sendMessage } from './telegramApi.js';
import { setTelegramUserAwaitingPassword } from './telegramFirestore.js';

export async function promptForPassword(chatId, tenantId, reason = '') {
  await setTelegramUserAwaitingPassword(tenantId, chatId, true);
  const intro = reason ? `${reason}\n\n` : '';
  await sendMessage(
    chatId,
    `${intro}<b>Inserisci la password del bot</b> (solo testo, un messaggio).`,
  );
}

export async function ensureAuthenticatedOrPrompt(chatId, tenantId, settings, user) {
  if (!settings.required) return true;
  const authed = user && user.passwordEpoch === settings.epoch;
  if (authed) return true;
  await promptForPassword(
    chatId,
    tenantId,
    'Accesso richiesto. La centrale ha impostato una password per il bot.',
  );
  return false;
}
