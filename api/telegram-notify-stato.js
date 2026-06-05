import { requireTenant } from './_lib/resolveTenant.js';
import { notifyMissionStatoToTelegram } from './_lib/telegramStatoNotify.js';
import { verifyFirebaseUser } from './_lib/verifyFirebaseUser.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);

    const body = req.body ?? {};
    const tenantId = requireTenant(req, body);
    const missionDocId = (body.missionDocId ?? body.docId ?? '').trim();
    if (!missionDocId) {
      return res.status(400).json({ error: 'Campo missionDocId obbligatorio' });
    }

    const eliminata = body.eliminata === true || body.motivo === 'eliminata';
    const result = await notifyMissionStatoToTelegram(tenantId, missionDocId, { eliminata });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[telegram-notify-stato]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
