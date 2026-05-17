import { getAdminDb } from './firebaseAdmin.js';
import { resolveMezzoSiglaForTelegram } from './mezzoResolve.js';

function mezzoRef(tenantId, sigla) {
  return getAdminDb()
    .collection('manifestazioni')
    .doc(tenantId)
    .collection('mezzi')
    .doc(sigla);
}

export function parseCoordinateStazionamento(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const x = Number(raw.x);
  const y = Number(raw.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/** Mezzo con posizione % sulla piantina tattica (dentro lo stadio). */
export function mezzoOnTacticalBoard(mezzo) {
  return parseCoordinateStazionamento(mezzo?.coordinate_stazionamento) != null;
}

export async function getMezzoForTelegram(tenantId, mezzoRaw) {
  const sigla = await resolveMezzoSiglaForTelegram(tenantId, String(mezzoRaw ?? '').trim());
  if (!sigla) return null;
  const snap = await mezzoRef(tenantId, sigla).get();
  if (!snap.exists) return null;
  return { sigla, ...snap.data() };
}

/** Equipaggio su mezzo in piantina: niente richiesta GPS Telegram. */
export async function mezzoRichiedeGpsTelegram(tenantId, mezzoRaw) {
  const mezzo = await getMezzoForTelegram(tenantId, mezzoRaw);
  if (!mezzo) return true;
  return !mezzoOnTacticalBoard(mezzo);
}

export const MSG_GPS_NON_RICHIESTO_PIANTINA =
  'ℹ️ Il mezzo è sulla <b>piantina tattica</b> (dentro lo stadio): la centrale usa quella posizione, <b>non serve inviare il GPS</b>.';
