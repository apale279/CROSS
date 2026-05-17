import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { getTelegramTenantId } from './_lib/env.js';
import { sendMessage } from './_lib/telegramApi.js';
import {
  findChatIdsByMezzo,
  isTelegramBotEnabled,
} from './_lib/telegramFirestore.js';
import { formatMissionTelegramHtml } from './_lib/telegramMissionMessage.js';

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  const idToken = authHeader.slice(7);
  return getAdminAuth().verifyIdToken(idToken);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);

    const tenantId = getTelegramTenantId();
    const body = req.body ?? {};
    const mezzo = (body.mezzo ?? body.mezzo_id ?? '').trim();
    const missione = body.missione ?? body.missione_data ?? body.missioneData;

    if (!mezzo) {
      return res.status(400).json({ error: 'Campo mezzo obbligatorio' });
    }
    if (!missione || typeof missione !== 'object') {
      return res.status(400).json({ error: 'Campo missione obbligatorio' });
    }

    const enabled = await isTelegramBotEnabled(tenantId);
    if (!enabled) {
      return res.status(403).json({
        error: 'Bot Telegram disattivato. Attivalo dalla dashboard CROSS.',
      });
    }

    const chatIds = await findChatIdsByMezzo(tenantId, mezzo, { authenticatedOnly: true });
    if (!chatIds.length) {
      return res.status(404).json({
        error: `Nessun equipaggio registrato (o non autenticato) su Telegram per il mezzo ${mezzo}. Chiedi di inviare /cambiapassword sul bot.`,
        sent: 0,
      });
    }

    const text = formatMissionTelegramHtml(missione);
    let sent = 0;
    const errors = [];

    for (const chatId of chatIds) {
      try {
        await sendMessage(chatId, text);
        sent += 1;
      } catch (e) {
        errors.push({ chatId, message: e.message });
      }
    }

    return res.status(200).json({
      ok: true,
      sent,
      total: chatIds.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-send]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
