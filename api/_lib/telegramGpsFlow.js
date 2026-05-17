import { answerCallbackQuery, escapeHtml, sendMessage } from './telegramApi.js';
import { updateMezzoPosizioneReale } from './mezzoPosizioneReale.js';
import { buildEquipaggioReplyKeyboard } from './telegramKeyboard.js';
import {
  getTelegramUser,
  setTelegramUserAwaitingGpsAfterStato,
  setTelegramUserGpsConsent,
} from './telegramFirestore.js';

export const GPS_CONSENT_PREFIX = 'gps_consent:';

export function buildLocationRequestKeyboard() {
  return {
    keyboard: [[{ text: '📍 Invia posizione GPS', request_location: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

export function buildGpsConsentKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: 'Sì, condividi GPS', callback_data: `${GPS_CONSENT_PREFIX}yes` },
        { text: 'No', callback_data: `${GPS_CONSENT_PREFIX}no` },
      ],
    ],
  };
}

export async function promptGpsConsentIfNeeded(chatId, tenantId) {
  const user = await getTelegramUser(tenantId, chatId);
  // Già attivo: non ripetere. Se "no" o mai chiesto → mostra di nuovo (es. dopo /start + nuovo mezzo).
  if (user?.gpsStatoConsenso === true) {
    return;
  }
  await sendMessage(
    chatId,
    '<b>Posizione GPS</b>\n\nVuoi inviare la posizione GPS alla centrale <b>ogni volta che aggiorni lo stato missione</b> da Telegram?\n\nPotrai cambiare idea in qualsiasi momento con /gps.',
    { reply_markup: buildGpsConsentKeyboard() },
  );
}

export async function handleGpsConsentCallback(callbackQuery, tenantId) {
  const data = callbackQuery.data ?? '';
  if (!data.startsWith(GPS_CONSENT_PREFIX)) return false;

  const choice = data.slice(GPS_CONSENT_PREFIX.length);
  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId) return false;

  const consent = choice === 'yes';
  await setTelegramUserGpsConsent(tenantId, chatId, consent);

  await answerCallbackQuery(
    callbackQuery.id,
    consent ? 'GPS attivo sugli stati' : 'GPS disattivato',
  );

  if (consent) {
    await sendMessage(
      chatId,
      '✅ <b>GPS attivo.</b> Dopo ogni aggiornamento stato ti chiederemo la posizione.\n\n' +
        'Puoi inviare una <b>posizione live</b> (condividi posizione → durata) per aggiornamenti automatici, ' +
        'oppure usare il pulsante <b>Invia posizione GPS</b> ogni volta.',
      { reply_markup: buildLocationRequestKeyboard() },
    );
  } else {
    await sendMessage(
      chatId,
      'ℹ️ Posizione GPS non richiesta sugli aggiornamenti stato. Per attivarla: /gps',
      { reply_markup: buildEquipaggioReplyKeyboard() },
    );
  }
  return true;
}

/** Dopo avanzamento stato: chiedi posizione se l\'equipaggio ha dato consenso. */
export async function promptGpsAfterStatoAdvance(chatId, tenantId) {
  const user = await getTelegramUser(tenantId, chatId);
  if (user?.gpsStatoConsenso !== true || !user?.mezzo?.trim()) return;

  await setTelegramUserAwaitingGpsAfterStato(tenantId, chatId, true);
  await sendMessage(
    chatId,
    '📍 <b>Aggiorna posizione mezzo</b>\n\nInvia la posizione GPS attuale per aggiornare la centrale (tasto qui sotto).',
    { reply_markup: buildLocationRequestKeyboard() },
  );
}

function extractLocation(loc) {
  if (!loc) return null;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const precisione =
    loc.horizontal_accuracy != null ? Number(loc.horizontal_accuracy) : null;
  return {
    lat,
    lng,
    precisione: Number.isFinite(precisione) ? precisione : null,
    live: Boolean(loc.live_period),
  };
}

export async function handleLocationMessage(chatId, tenantId, message) {
  const loc = extractLocation(message?.location);
  if (!loc) return false;

  const user = await getTelegramUser(tenantId, chatId);
  const mezzo = user?.mezzo?.trim();
  if (!mezzo) {
    await sendMessage(chatId, 'Prima invia <b>/start</b> e scegli il mezzo, poi condividi la posizione.');
    return true;
  }

  try {
    await updateMezzoPosizioneReale(tenantId, mezzo, loc.lat, loc.lng, {
      precisione: loc.precisione,
      fonte: 'telegram',
    });
  } catch (err) {
    await sendMessage(chatId, `❌ ${escapeHtml(err.message ?? 'Errore salvataggio posizione')}`);
    return true;
  }

  if (user?.awaitingGpsAfterStato) {
    await setTelegramUserAwaitingGpsAfterStato(tenantId, chatId, false);
  }

  const maps = `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`;
  await sendMessage(
    chatId,
    `✅ <b>Posizione aggiornata</b> per mezzo <b>${escapeHtml(mezzo)}</b>.\n<a href="${escapeHtml(maps)}">Apri su Maps</a>${loc.live ? '\n<i>Posizione live attiva.</i>' : ''}`,
    { reply_markup: buildEquipaggioReplyKeyboard() },
  );
  return true;
}

export async function handleGpsCommand(chatId, tenantId) {
  const user = await getTelegramUser(tenantId, chatId);
  if (!user?.mezzo?.trim()) {
    await sendMessage(chatId, 'Prima invia <b>/start</b> e scegli il mezzo.');
    return;
  }

  if (user.gpsStatoConsenso !== true && user.gpsStatoConsenso !== false) {
    await promptGpsConsentIfNeeded(chatId, tenantId);
    return;
  }

  const attivo = user.gpsStatoConsenso === true;
  await sendMessage(
    chatId,
    attivo
      ? '📍 Condivisione GPS <b>attiva</b> sugli aggiornamenti stato.\n\nVuoi disattivarla o inviare subito una posizione?'
      : '📍 Condivisione GPS <b>disattiva</b>.\n\nVuoi attivarla per gli aggiornamenti stato?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: attivo ? 'Disattiva GPS' : 'Attiva GPS',
              callback_data: `${GPS_CONSENT_PREFIX}${attivo ? 'no' : 'yes'}`,
            },
            { text: '📍 Invia ora', callback_data: 'gps_send_now' },
          ],
        ],
      },
    },
  );
}

export async function handleGpsSendNowCallback(callbackQuery, tenantId) {
  if (callbackQuery.data !== 'gps_send_now') return false;

  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId) return false;

  const user = await getTelegramUser(tenantId, chatId);
  if (!user?.mezzo?.trim()) {
    await answerCallbackQuery(callbackQuery.id, 'Scegli prima il mezzo');
    return true;
  }

  await answerCallbackQuery(callbackQuery.id);
  await sendMessage(chatId, '📍 Invia la posizione attuale:', {
    reply_markup: buildLocationRequestKeyboard(),
  });
  return true;
}
