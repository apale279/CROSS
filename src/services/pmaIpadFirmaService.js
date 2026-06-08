import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, db, storage } from '../firebaseConfig';
import { apiUrl } from '../lib/apiUrl';
import { pmaIpadCredentialsFromEntry } from '../lib/pmaIpadCredentials';
import { patchPazientePmaGranular } from '../pma/lib/pazientePmaPatch';
import { writeStoredUserSessionToken } from '../lib/deviceSession';
import { initSessionDeviceClass, writeLastActivity } from '../lib/inactivityLogout';
import { ensureUserSessionToken } from './deviceSessionService';
import { ensurePmaIpadKioskProfile, userProfileDocRef } from './userProfileService';

export const PMA_IPAD_QUEUE_TTL_MS = 30 * 60 * 1000;

function ipadConfigRef(tenantId, pmaId) {
  return doc(db, 'manifestazioni', tenantId, 'pma_firma_ipad', pmaId);
}

function ipadQueueRef(tenantId, pmaId) {
  return doc(db, 'manifestazioni', tenantId, 'pma_firma_coda', pmaId);
}

export function randomPmaIpadToken() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/** @param {string} tenantId @param {string} pmaId */
export async function fetchPmaIpadConfig(tenantId, pmaId) {
  const snap = await getDoc(ipadConfigRef(tenantId, pmaId));
  return snap.exists() ? snap.data() : null;
}

/**
 * Allinea Firestore `pma_firma_ipad` alle credenziali sul record PMA in impostazioni.
 * @param {string} tenantId
 * @param {{ id: string; nome?: string; ipadUser?: string; ipadPassword?: string; ipadEmail?: string }} pmaEntry
 */
export async function syncPmaIpadConfigFromPmaEntry(tenantId, pmaEntry) {
  const pmaId = String(pmaEntry?.id ?? '').trim();
  if (!tenantId || !pmaId) return null;
  const creds = pmaIpadCredentialsFromEntry(pmaEntry);
  await setDoc(
    ipadConfigRef(tenantId, pmaId),
    {
      kioskEmail: creds.ipadEmail,
      kioskPassword: creds.ipadPassword,
      ipadUser: creds.ipadUser,
      pmaNome: String(pmaEntry.nome ?? '').trim(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  return creds;
}

function mapIpadAuthError(code) {
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Registrazione email/password disabilitata in Firebase. Abilita il provider Email/Password.';
    case 'auth/weak-password':
      return 'Password iPad non valida.';
    case 'auth/invalid-email':
      return 'Email iPad non valida.';
    default:
      return null;
  }
}

/**
 * Login automatico iPad: account `nomepma_ipad` + password del PMA (creati con il PMA).
 * @param {string} tenantId
 * @param {string} pmaId
 * @param {string} [pmaNome]
 * @param {{ nome?: string; ipadUser?: string; ipadPassword?: string; ipadEmail?: string }} [pmaEntry]
 */
export async function signInPmaIpadKiosk(tenantId, pmaId, pmaNome = '', pmaEntry = null) {
  let config = await fetchPmaIpadConfig(tenantId, pmaId);
  const creds = pmaIpadCredentialsFromEntry(
    pmaEntry ?? {
      nome: pmaNome || config?.pmaNome,
      ipadUser: config?.ipadUser,
      ipadPassword: config?.kioskPassword,
      ipadEmail: config?.kioskEmail,
    },
  );

  if (!config?.kioskEmail) {
    if (!pmaEntry?.id && !pmaId) {
      throw new Error('PMA non configurato per iPad firma.');
    }
    await syncPmaIpadConfigFromPmaEntry(tenantId, {
      id: pmaId,
      nome: pmaNome,
      ...creds,
    });
    config = await fetchPmaIpadConfig(tenantId, pmaId);
  }

  const email = String(config?.kioskEmail ?? creds.ipadEmail).trim().toLowerCase();
  const password = String(config?.kioskPassword ?? creds.ipadPassword).trim();
  const displayPmaNome = String(pmaNome || config?.pmaNome || pmaId).trim();

  if (!email || password.length < 6) {
    throw new Error('Credenziali iPad mancanti. Ricrea o salva il PMA dalle impostazioni.');
  }

  await signOut(auth).catch(() => {});

  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, password);
  } catch (signInErr) {
    const code = signInErr?.code ?? '';
    if (code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
      throw new Error(mapIpadAuthError(code) ?? signInErr.message ?? 'Accesso iPad non riuscito.');
    }
    try {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    } catch (createErr) {
      const cCode = createErr?.code ?? '';
      if (cCode === 'auth/email-already-in-use') {
        cred = await signInWithEmailAndPassword(auth, email, password);
      } else {
        throw new Error(
          mapIpadAuthError(cCode) ?? createErr.message ?? 'Creazione account iPad non riuscita.',
        );
      }
    }
  }

  await ensurePmaIpadKioskProfile(tenantId, cred.user.uid, {
    email,
    pmaId,
    pmaNome: displayPmaNome,
  });

  const sessionToken = await ensureUserSessionToken(tenantId, cred.user.uid);
  writeStoredUserSessionToken(tenantId, cred.user.uid, sessionToken);
  initSessionDeviceClass();
  writeLastActivity(tenantId, cred.user.uid);

  await setDoc(
    ipadConfigRef(tenantId, pmaId),
    {
      kioskUid: cred.user.uid,
      kioskProvisionedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  return config;
}

/** @param {Record<string, unknown> | null} queueDoc */
export function parsePmaIpadQueueRequest(queueDoc) {
  if (!queueDoc?.request || typeof queueDoc.request !== 'object') return null;
  const r = queueDoc.request;
  const expiresAtMs = Number(r.expiresAtMs);
  if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) return null;
  const status = String(r.status ?? 'pending');
  if (status === 'cancelled') return null;
  return r;
}

export function subscribePmaIpadFirmaQueue(tenantId, pmaId, onData) {
  if (!tenantId || !pmaId) return () => {};
  return onSnapshot(
    ipadQueueRef(tenantId, pmaId),
    (snap) => onData(snap.exists() ? snap.data() : null),
    () => onData(null),
  );
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error('Lettura PDF non riuscita.'));
    reader.readAsDataURL(blob);
  });
}

function cloudinaryViteClientConfig() {
  return {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim() ?? '',
    preset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim() ?? '',
  };
}

function devCloudinaryClientHint() {
  const { cloudName, preset } = cloudinaryViteClientConfig();
  if (cloudName && preset) return null;
  const missing = [
    !cloudName ? 'VITE_CLOUDINARY_CLOUD_NAME' : null,
    !preset ? 'VITE_CLOUDINARY_UPLOAD_PRESET' : null,
  ].filter(Boolean);
  return (
    `In .env.local mancano ${missing.join(' e ')} (obbligatorio il prefisso VITE_ per il browser). ` +
    'Riavvia "npm run dev" dopo ogni modifica al file.'
  );
}

function devCloudinaryServerFallbackHint(serverMessage) {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim() || 'Vercel (produzione)';
  return (
    `${serverMessage} ` +
    `Con "npm run dev" la route /api viene inoltrata a ${apiBase}: le variabili CLOUDINARY_* nel tuo .env.local non valgono per quell'upload. ` +
    'Usa VITE_CLOUDINARY_CLOUD_NAME + VITE_CLOUDINARY_UPLOAD_PRESET in .env.local, oppure avvia "vercel dev" per eseguire le API in locale.'
  );
}

async function uploadPmaFirmaPdfViaApi(tenantId, blob, pazienteDocId) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Devi essere autenticato per inviare il documento all\'iPad.');
  }
  const token = await user.getIdToken();
  const fileBase64 = await blobToBase64(blob);
  const res = await fetch(apiUrl('/api/pma-firma-pdf-upload'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileBase64,
      mimeType: 'application/pdf',
      pazienteDocId,
      tenantId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const serverMsg =
      data.error ??
      'Upload PDF su server non riuscito. Verifica CLOUDINARY_* su Vercel (o avvia `vercel dev` in locale).';
    if (import.meta.env.DEV && res.status === 503 && /CLOUDINARY/i.test(String(serverMsg))) {
      throw new Error(devCloudinaryServerFallbackHint(serverMsg));
    }
    throw new Error(serverMsg);
  }
  if (!data.url) throw new Error('Upload PDF: URL mancante nella risposta.');
  return String(data.url);
}

async function uploadPmaFirmaPdfUnsigned(tenantId, blob, pazienteDocId) {
  const { cloudName, preset } = cloudinaryViteClientConfig();
  if (!cloudName || !preset) {
    throw new Error('PRESET_CLIENT_SKIP');
  }
  const file = new File([blob], `firma-preview-${pazienteDocId}.pdf`, { type: 'application/pdf' });
  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', preset);
  body.append('folder', `cross/pma-firma/${tenantId}`);
  body.append('tags', 'cross,pma,firma,preview');

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`, {
    method: 'POST',
    body,
  });
  const data = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    const msg = String(data.error?.message ?? '');
    throw new Error(msg || `Upload PDF anteprima fallito (${uploadRes.status})`);
  }
  if (!data.secure_url) throw new Error('Upload PDF: URL mancante.');
  return String(data.secure_url);
}

function pmaFirmaPdfStoragePath(tenantId, pazienteDocId) {
  const safeId = String(pazienteDocId ?? 'paziente').replace(/[^\w.-]+/g, '_').slice(0, 40);
  return `manifestazioni/${tenantId}/pma_firma_preview/${safeId}/${Date.now()}.pdf`;
}

/** Fallback locale/produzione senza Cloudinary: Firebase Storage (regole read autenticato). */
async function uploadPmaFirmaPdfFirebaseStorage(tenantId, blob, pazienteDocId) {
  const storageRef = ref(storage, pmaFirmaPdfStoragePath(tenantId, pazienteDocId));
  await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
  return getDownloadURL(storageRef);
}

function uploadPmaFirmaErrMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

/** Carica anteprima PDF dimissione per iPad (Cloudinary unsigned, Firebase Storage o API server). */
export async function uploadPmaFirmaPdfPreview(tenantId, blob, pazienteDocId) {
  if (blob.size > 15 * 1024 * 1024) {
    throw new Error('PDF troppo grande (max 15 MB).');
  }

  const attempts = [];
  const skipRemoteApi =
    import.meta.env.DEV && Boolean(import.meta.env.VITE_API_BASE_URL?.trim());

  try {
    return await uploadPmaFirmaPdfUnsigned(tenantId, blob, pazienteDocId);
  } catch (err) {
    attempts.push(`Cloudinary: ${uploadPmaFirmaErrMessage(err)}`);
  }

  try {
    return await uploadPmaFirmaPdfFirebaseStorage(tenantId, blob, pazienteDocId);
  } catch (err) {
    attempts.push(`Storage: ${uploadPmaFirmaErrMessage(err)}`);
    console.warn('[pma-firma] Upload Firebase Storage non riuscito:', err);
  }

  if (!skipRemoteApi) {
    try {
      return await uploadPmaFirmaPdfViaApi(tenantId, blob, pazienteDocId);
    } catch (err) {
      attempts.push(`Server: ${uploadPmaFirmaErrMessage(err)}`);
    }
  } else {
    const hint = devCloudinaryClientHint();
    if (hint) attempts.push(hint);
  }

  throw new Error(`Upload anteprima PDF per iPad non riuscito. ${attempts.join(' · ')}`);
}

export async function pushPmaIpadFirmaRequest(tenantId, pmaId, payload) {
  const requestId = randomPmaIpadToken();
  const now = Date.now();
  await setDoc(ipadQueueRef(tenantId, pmaId), {
    activeRequestId: requestId,
    request: {
      id: requestId,
      pazienteDocId: String(payload.pazienteDocId ?? '').trim(),
      idPaziente: String(payload.idPaziente ?? '').trim(),
      pdfPreviewUrl: String(payload.pdfPreviewUrl ?? '').trim(),
      requestedAt: serverTimestamp(),
      requestedByUid: String(payload.requestedByUid ?? '').trim(),
      requestedByNome: String(payload.requestedByNome ?? '').trim(),
      expiresAtMs: now + PMA_IPAD_QUEUE_TTL_MS,
      status: 'pending',
    },
    updatedAt: serverTimestamp(),
  });
  return requestId;
}

export async function cancelPmaIpadFirmaRequest(tenantId, pmaId) {
  await updateDoc(ipadQueueRef(tenantId, pmaId), {
    'request.status': 'cancelled',
    updatedAt: serverTimestamp(),
  }).catch(async () => {
    await setDoc(
      ipadQueueRef(tenantId, pmaId),
      { request: { status: 'cancelled' }, updatedAt: serverTimestamp() },
      { merge: true },
    );
  });
}

export async function completePmaIpadFirmaRequest(
  tenantId,
  pmaId,
  requestId,
  pazienteDocId,
  firmaDataUrl,
) {
  const queueRef = ipadQueueRef(tenantId, pmaId);
  const pazienteId = String(pazienteDocId ?? '').trim();
  const reqId = String(requestId ?? '').trim();
  if (!pazienteId || !reqId) {
    throw new Error('Richiesta firma iPad non valida.');
  }

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(queueRef);
    if (!snap.exists()) {
      throw new Error('Coda firma iPad non trovata.');
    }
    const data = snap.data();
    const req = data?.request;
    if (!req || typeof req !== 'object') {
      throw new Error('Nessuna richiesta di firma attiva.');
    }
    if (String(data.activeRequestId ?? '') !== reqId || String(req.id ?? '') !== reqId) {
      throw new Error('Richiesta di firma non più valida. Rinvia il documento dal PC.');
    }
    if (String(req.status ?? '') !== 'pending') {
      throw new Error('Richiesta di firma già completata o annullata.');
    }
    if (String(req.pazienteDocId ?? '').trim() !== pazienteId) {
      throw new Error('Il documento non corrisponde al paziente in coda.');
    }
    const expiresAtMs = Number(req.expiresAtMs);
    if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
      throw new Error('Richiesta di firma scaduta.');
    }
  });

  await patchPazientePmaGranular(tenantId, pazienteId, {
    firma_paziente_base64: firmaDataUrl,
    firma_paziente_url: deleteField(),
  });

  await updateDoc(queueRef, {
    'request.status': 'signed',
    'request.signedAt': serverTimestamp(),
    'request.firmaSaved': true,
    updatedAt: serverTimestamp(),
  });
}
