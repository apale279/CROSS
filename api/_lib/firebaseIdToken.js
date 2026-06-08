import crypto from 'node:crypto';
import { stripEnvValue } from './env.js';

const CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const CACHE_MS = 60 * 60 * 1000;

let cachedKeys = null;
let cacheAt = 0;

export function getFirebaseProjectId() {
  return (
    stripEnvValue(process.env.FIREBASE_PROJECT_ID) ||
    stripEnvValue(process.env.VITE_FIREBASE_PROJECT_ID) ||
    stripEnvValue(process.env.GCLOUD_PROJECT) ||
    ''
  );
}

function decodeJwtPart(part) {
  const padded = part.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return JSON.parse(Buffer.from(padded + pad, 'base64').toString('utf8'));
}

async function getFirebasePublicKeys() {
  if (cachedKeys && Date.now() - cacheAt < CACHE_MS) return cachedKeys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw Object.assign(new Error('Chiavi pubbliche Firebase Auth non raggiungibili'), {
      status: 503,
    });
  }
  cachedKeys = await res.json();
  cacheAt = Date.now();
  return cachedKeys;
}

/**
 * Verifica ID token Firebase senza service account (solo FIREBASE_PROJECT_ID / VITE_FIREBASE_PROJECT_ID).
 * @throws {Error & { status?: number }}
 */
export async function verifyFirebaseIdToken(idToken) {
  const projectId = getFirebaseProjectId();
  if (!projectId) {
    throw Object.assign(
      new Error('FIREBASE_PROJECT_ID (o VITE_FIREBASE_PROJECT_ID) non configurato su Vercel'),
      { status: 503 },
    );
  }

  const token = String(idToken ?? '').trim();
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw Object.assign(new Error('Token di autenticazione non valido'), { status: 401 });
  }

  const header = decodeJwtPart(parts[0]);
  const payload = decodeJwtPart(parts[1]);
  const keys = await getFirebasePublicKeys();
  const pem = keys[header.kid];
  if (!pem) {
    throw Object.assign(new Error('Token di autenticazione non valido (kid)'), { status: 401 });
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  const sig = parts[2].replace(/-/g, '+').replace(/_/g, '/');
  const sigPad = sig.length % 4 === 0 ? sig : sig + '='.repeat(4 - (sig.length % 4));
  const ok = verifier.verify(pem, sigPad, 'base64');
  if (!ok) {
    throw Object.assign(new Error('Token di autenticazione non valido (firma)'), { status: 401 });
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw Object.assign(new Error('Token di autenticazione scaduto'), { status: 401 });
  }
  if (payload.iat && payload.iat > now + 300) {
    throw Object.assign(new Error('Token di autenticazione non ancora valido'), { status: 401 });
  }
  if (payload.aud !== projectId) {
    throw Object.assign(new Error('Token di autenticazione non valido (audience)'), { status: 401 });
  }
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw Object.assign(new Error('Token di autenticazione non valido (issuer)'), { status: 401 });
  }
  if (!payload.sub) {
    throw Object.assign(new Error('Token di autenticazione non valido (sub)'), { status: 401 });
  }

  return payload;
}
