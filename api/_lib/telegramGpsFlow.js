import { answerCallbackQuery, escapeHtml, sendMessage } from './telegramApi.js';
import { updateMezzoPosizioneReale } from './mezzoPosizioneReale.js';
import {
  mezzoRichiedeGpsTelegram,
  MSG_GPS_NON_RICHIESTO_PIANTINA,
} from './mezzoTacticalBoard.js';
import { buildEquipaggioReplyKeyboard } from './telegramKeyboard.js';
import {
  getTelegramUser,
  isTelegramGpsTrackingEnabled,
  setTelegramUserAwaitingGpsAfterStato,
  setTelegramUserGpsConsent,
} from './telegramFirestore.js';
import { TG_MENU_GPS } from './telegramKeyboard.js';

export const GPS_CONSENT_PREFIX = 'gps_consent:';

export const MSG_GPS_TRACKING_DISATTIVATO =
  'ℹ️ Il <b>tracking GPS</b> è <b>disattivato</b> dalla centrale (Impostazioni → Telegram). La posizione del mezzo resta quella di stazionamento.';

async function gpsTrackingAttivo(tenantId, chatId) {
  if (await isTelegramGpsTrackingEnabled(tenantId)) return true;
  await sendMessage(chatId, MSG_GPS_TRACKING_DISATTIVATO, {
    reply_markup: buildEquipaggioReplyKeyboard(),
  });
  return false;
}

export function buildLocationRequestKeyboard() {
  return {
    inline_keyboard: [[{ text: '📍 Come inviare posizione', callback_data: 'gps_send_now' }]],
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
  if (!(await isTelegramGpsTrackingEnabled(tenantId))) return;

  const user = await getTelegramUser(tenantId, chatId);
  const mezzo = user?.mezzo?.trim();
  if (!mezzo) return;

  if (!(await mezzoRichiedeGpsTelegram(tenantId, mezzo))) {
    await setTelegramUserGpsConsent(tenantId, chatId, false);
    await sendMessage(chatId, MSG_GPS_NON_RICHIESTO_PIANTINA, {
      reply_markup: buildEquipaggioReplyKeyboard(),
    });
    return;
  }

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
  if (choice !== 'yes' && choice !== 'no') return false;

  const chatId = callbackQuery.message?.chat?.id ?? callbackQuery.from?.id;
  if (!chatId) return false;

  if (!(await isTelegramGpsTrackingEnabled(tenantId))) {
    await answerCallbackQuery(callbackQuery.id, 'Tracking GPS disattivato');
    await sendMessage(chatId, MSG_GPS_TRACKING_DISATTIVATO, {
      reply_markup: buildEquipaggioReplyKeyboard(),
    });
    return true;
  }

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
        'Puoi inviare una <b>posizione live</b> (Condividi → Posizione) oppure una posizione puntuale dal menu allegati.',
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
  if (!(await isTelegramGpsTrackingEnabled(tenantId))) return;

  const user = await getTelegramUser(tenantId, chatId);
  const mezzo = user?.mezzo?.trim();
  if (user?.gpsStatoConsenso !== true || !mezzo) return;
  if (!(await mezzoRichiedeGpsTelegram(tenantId, mezzo))) return;

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

  if (!(await gpsTrackingAttivo(tenantId, chatId))) return true;

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
  const mezzo = user?.mezzo?.trim();
  if (!mezzo) {
    await sendMessage(chatId, 'Prima invia <b>/start</b> e scegli il mezzo.');
    return;
  }

  if (!(await gpsTrackingAttivo(tenantId, chatId))) return;

  if (!(await mezzoRichiedeGpsTelegram(tenantId, mezzo))) {
    await sendMessage(chatId, MSG_GPS_NON_RICHIESTO_PIANTINA, {
      reply_markup: buildEquipaggioReplyKeyboard(),
    });
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

  if (!(await isTelegramGpsTrackingEnabled(tenantId))) {
    await answerCallbackQuery(callbackQuery.id, 'Tracking GPS disattivato');
    await sendMessage(chatId, MSG_GPS_TRACKING_DISATTIVATO, {
      reply_markup: buildEquipaggioReplyKeyboard(),
    });
    return true;
  }

  const user = await getTelegramUser(tenantId, chatId);
  const mezzo = user?.mezzo?.trim();
  if (!mezzo) {
    await answerCallbackQuery(callbackQuery.id, 'Scegli prima il mezzo');
    return true;
  }

  if (!(await mezzoRichiedeGpsTelegram(tenantId, mezzo))) {
    await answerCallbackQuery(callbackQuery.id, 'GPS non richiesto (piantina tattica)');
    await sendMessage(chatId, MSG_GPS_NON_RICHIESTO_PIANTINA, {
      reply_markup: buildEquipaggioReplyKeyboard(),
    });
    return true;
  }

  await answerCallbackQuery(callbackQuery.id);
  await sendMessage(
    chatId,
    '📍 Invia ora la posizione dal client Telegram:\n' +
      '1) Apri <b>Allegati</b> (graffetta)\n' +
      '2) Seleziona <b>Posizione</b>\n' +
      '3) Invia posizione attuale o live\n\n' +
      'Quando arriva una location, CROSS aggiorna subito il mezzo.',
    {
      reply_markup: {
        inline_keyboard: [[{ text: '📍 GPS mezzo', callback_data: TG_MENU_GPS }]],
      },
    },
  );
  return true;
}
