import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { stripEnvValue } from './env.js';

let app;

function parseServiceAccountJson() {
  const raw = stripEnvValue(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (!raw || raw.length < 20) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON mancante o troncato su Vercel (serve il JSON completo del service account)',
    );
  }

  try {
    return JSON.parse(raw);
  } catch {
    /* base64 opzionale */
  }

  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON non è JSON valido');
  }
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
