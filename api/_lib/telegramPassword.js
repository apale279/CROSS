import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 64;

export function hashBotPassword(password, saltHex = null) {
  const salt = saltHex ?? randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LEN).toString('hex');
  return { salt, hash };
}

export function verifyBotPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  try {
    const attempt = scryptSync(password, salt, KEY_LEN);
    const expected = Buffer.from(hash, 'hex');
    if (attempt.length !== expected.length) return false;
    return timingSafeEqual(attempt, expected);
  } catch {
    return false;
  }
}

/** Impostazioni password da documento impostazioni Firestore. */
export function parseTelegramPasswordSettings(data) {
  const salt = data?.telegramBotPasswordSalt ?? '';
  const hash = data?.telegramBotPasswordHash ?? '';
  const epoch = Number(data?.telegramPasswordEpoch ?? 0) || 0;
  const required = Boolean(salt && hash);
  return { required, salt, hash, epoch };
}

export function isUserTelegramAuthenticated(userData, settings) {
  if (!settings.required) return true;
  const userEpoch = Number(userData?.passwordEpoch ?? 0) || 0;
  return userEpoch === settings.epoch && userEpoch > 0;
}
