import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { requireTenant } from './_lib/resolveTenant.js';
import { sendMessage } from './_lib/telegramApi.js';
import { resolveMezzoSiglaForTelegram } from './_lib/mezzoResolve.js';
import {
  findChatIdsByMezzo,
  isTelegramBotEnabled,
} from './_lib/telegramFirestore.js';
import { getStatiMissione } from './_lib/missionAdmin.js';
import { formatMissionTelegramHtml } from './_lib/telegramMissionMessage.js';
import { buildStatoAdvanceKeyboard } from './_lib/telegramMissionStato.js';
import { isStatoMissioneTerminale, nextStatoMissione } from './_lib/missionStati.js';
import { appendMissionTelegramMessage } from './_lib/telegramMissionMessages.js';

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

    const body = req.body ?? {};
    const tenantId = requireTenant(req, body);
    const mezzoRaw = (body.mezzo ?? body.mezzo_id ?? '').trim();
    const missione = body.missione ?? body.missione_data ?? body.missioneData;

    if (!mezzoRaw) {
      return res.status(400).json({ error: 'Campo mezzo obbligatorio' });
    }

    const mezzo = await resolveMezzoSiglaForTelegram(tenantId, mezzoRaw);
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
      const hint =
        mezzo !== mezzoRaw
          ? ` (missione: ${mezzoRaw} → mezzo attuale: ${mezzo})`
          : '';
      return res.status(404).json({
        error: `Nessun equipaggio registrato su Telegram per il mezzo ${mezzo}${hint}. Chiedi: /cambiapassword (se serve), poi /start e scelta mezzo.`,
        sent: 0,
        mezzoResolved: mezzo,
        mezzoRequested: mezzoRaw,
      });
    }

    const text = formatMissionTelegramHtml(missione);
    const missionDocId = (missione.missionDocId ?? missione._docId ?? '').trim();
    let replyMarkup;
    if (missionDocId && missione.aperta !== false && !isStatoMissioneTerminale(missione.stato)) {
      const stati = await getStatiMissione(tenantId);
      const next = nextStatoMissione(missione.stato ?? 'ALLERTARE', stati);
      if (next !== missione.stato) {
        replyMarkup = buildStatoAdvanceKeyboard(missionDocId, next);
      }
    }

    let sent = 0;
    const errors = [];

    for (const chatId of chatIds) {
      try {
        const apiRes = await sendMessage(
          chatId,
          text,
          replyMarkup ? { reply_markup: replyMarkup } : {},
        );
        const messageId = apiRes?.result?.message_id;
        if (missionDocId && messageId != null) {
          await appendMissionTelegramMessage(tenantId, missionDocId, chatId, messageId);
        }
        sent += 1;
      } catch (e) {
        errors.push({ chatId, message: e.message });
      }
    }

    if (sent === 0) {
      return res.status(502).json({
        error: 'Impossibile inviare su Telegram (errore API). Riprova.',
        sent: 0,
        total: chatIds.length,
        errors,
        mezzoResolved: mezzo,
      });
    }

    return res.status(200).json({
      ok: true,
      sent,
      total: chatIds.length,
      mezzoResolved: mezzo !== mezzoRaw ? mezzo : undefined,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-send]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
