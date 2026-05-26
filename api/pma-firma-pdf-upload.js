import { getAdminAuth } from './_lib/firebaseAdmin.js';
import { getTelegramTenantId } from './_lib/env.js';

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

async function verifyFirebaseUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw Object.assign(new Error('Token di autenticazione mancante'), { status: 401 });
  }
  return getAdminAuth().verifyIdToken(authHeader.slice(7));
}

async function uploadBufferToCloudinary(buffer, mime, tenantId, pazienteDocId) {
  const cfg = getCloudinaryConfig();
  if (!cfg) {
    throw Object.assign(new Error('Cloudinary non configurato sul server'), { status: 503 });
  }

  const credentials = Buffer.from(`${cfg.apiKey}:${cfg.apiSecret}`).toString('base64');
  const safeId = String(pazienteDocId ?? 'paziente').replace(/[^\w.-]+/g, '_').slice(0, 40);
  const form = new FormData();
  form.append(
    'file',
    new Blob([buffer], { type: mime || 'application/pdf' }),
    `firma-preview-${safeId}.pdf`,
  );
  form.append('folder', `cross/pma-firma/${tenantId}`);
  form.append('tags', 'cross,pma,firma,preview');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cfg.cloudName}/raw/upload`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
      body: form,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error?.message ?? 'Upload Cloudinary fallito'), {
      status: 502,
    });
  }
  return data.secure_url;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await verifyFirebaseUser(req);

    const cfg = getCloudinaryConfig();
    if (!cfg) {
      return res.status(503).json({
        error:
          'Configura CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET (Vercel o .env.local).',
      });
    }

    const tenantId = getTelegramTenantId();
    const body = req.body ?? {};
    const b64 = body.fileBase64 ?? body.data;
    if (!b64 || typeof b64 !== 'string') {
      return res.status(400).json({ error: 'Campo fileBase64 obbligatorio' });
    }

    const mime = body.mimeType ?? 'application/pdf';
    const buffer = Buffer.from(b64, 'base64');

    if (buffer.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'PDF troppo grande (max 15 MB)' });
    }

    const url = await uploadBufferToCloudinary(
      buffer,
      mime,
      tenantId,
      body.pazienteDocId ?? '',
    );
    return res.status(200).json({ ok: true, url });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) console.error('[pma-firma-pdf-upload]', err);
    return res.status(status).json({ error: err.message ?? 'Internal error' });
  }
}
