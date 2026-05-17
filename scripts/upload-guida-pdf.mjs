#!/usr/bin/env node
/**
 * Carica la guida PDF su Cloudinary e salva guida_pdf_url in Firestore impostazioni.
 *
 * Richiede in .env.local (o ambiente):
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *   FIREBASE_SERVICE_ACCOUNT_JSON
 *   TELEGRAM_TENANT_ID o VITE_TENANT_ID
 *
 * Uso:
 *   node --env-file=.env.local scripts/upload-guida-pdf.mjs
 *   node --env-file=.env.local scripts/upload-guida-pdf.mjs "percorso/guida.pdf"
 */
import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function stripEnv(value) {
  const s = String(value ?? '').trim();
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    return s.slice(1, -1).trim();
  }
  return s;
}

function getCloudinaryConfig() {
  const cloudName = stripEnv(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = stripEnv(process.env.CLOUDINARY_API_KEY);
  const apiSecret = stripEnv(process.env.CLOUDINARY_API_SECRET);
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Imposta CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET');
  }
  return { cloudName, apiKey, apiSecret };
}

function initAdmin() {
  const raw = stripEnv(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON mancante');
  const serviceAccount = JSON.parse(raw);
  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  return getFirestore();
}

async function uploadPdfToCloudinary(buffer, tenantId, fileName) {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/pdf' }), fileName);
  form.append('folder', `cross/guida/${tenantId}`);
  form.append('tags', 'cross,guida,pdf,cli');

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error?.message ?? `Cloudinary upload fallito (${res.status})`);
  }
  if (!data.secure_url) throw new Error('Cloudinary: secure_url mancante');
  return data.secure_url;
}

const pdfPath = process.argv[2]
  ? join(process.cwd(), process.argv[2])
  : join(ROOT, 'GUIDA.pdf');

if (!existsSync(pdfPath)) {
  console.error('File non trovato:', pdfPath);
  console.error('Uso: node --env-file=.env.local scripts/upload-guida-pdf.mjs [percorso.pdf]');
  process.exit(1);
}

const tenantId =
  stripEnv(process.env.TELEGRAM_TENANT_ID) || stripEnv(process.env.VITE_TENANT_ID);
if (!tenantId) {
  console.error('Imposta TELEGRAM_TENANT_ID o VITE_TENANT_ID');
  process.exit(1);
}

const buffer = readFileSync(pdfPath);
if (buffer.length > 15 * 1024 * 1024) {
  console.error('File troppo grande (max 15 MB)');
  process.exit(1);
}

const fileName = basename(pdfPath).toLowerCase().endsWith('.pdf')
  ? basename(pdfPath)
  : `${basename(pdfPath)}.pdf`;

console.log('Upload', pdfPath, `(${Math.round(buffer.length / 1024)} KB) → Cloudinary…`);
const url = await uploadPdfToCloudinary(buffer, tenantId, fileName);

const db = initAdmin();
const ref = db.doc(`manifestazioni/${tenantId}/settings/impostazioni`);
await ref.set({ manifestationId: tenantId, guida_pdf_url: url }, { merge: true });

console.log('OK — guida_pdf_url salvato in Firestore');
console.log('URL:', url);
