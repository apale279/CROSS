import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { stripEnvValue } from './env.js';

let app;

function parseJsonServiceAccount(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length < 20) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.project_id && parsed?.private_key) return parsed;
  } catch {
    /* try base64 */
  }

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    if (parsed?.project_id && parsed?.private_key) return parsed;
  } catch {
    /* invalid */
  }

  return null;
}

function parseServiceAccountJson() {
  const fromB64Env = parseJsonServiceAccount(
    stripEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64),
  );
  if (fromB64Env) return fromB64Env;

  const fromJsonEnv = parseJsonServiceAccount(
    stripEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  );
  if (fromJsonEnv) return fromJsonEnv;

  throw new Error(
    'FIREBASE_SERVICE_ACCOUNT_JSON mancante o troncato su Vercel. Incolla il JSON su una riga oppure usa FIREBASE_SERVICE_ACCOUNT_JSON_BASE64 (file service account codificato in base64).',
  );
}

function initAdmin() {
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }

  const serviceAccount = parseServiceAccountJson();

  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  return app;
}

export function getAdminDb() {
  initAdmin();
  return getFirestore();
}

export function getAdminAuth() {
  initAdmin();
  return getAuth();
}

export { FieldValue };
