import { Timestamp } from 'firebase/firestore';
import { DEFAULT_IMPOSTAZIONI } from '../constants';
import {
  CUTE_OPTIONS,
  normalizeCute,
  normalizeMeccanica,
} from './msbValutazione';

export const RITMO_PRESENTAZIONE_OPTS = ['defibrillabile', 'non defibrillabile'];

export function emptyMsaParametri() {
  return {
    fr: 12,
    meccanicaRespiratoria: ['Eupnoico'],
    cute: [],
    spo2Aa: 100,
    spo2O2: 100,
    fc: 70,
    paSis: 120,
    paDia: 80,
    temperatura: 37,
    glicemia: null,
    gcs: 15,
  };
}

export function emptyMsaAcc() {
  return {
    /** Se true (ACC attivo): mostra e salva i campi arresto cardiocircolatorio. */
    attivo: false,
    dataOraAcc: null,
    testimoniato: 'NO',
    bystanderRcp: 'NO',
    bystanderInizio: null,
    bystanderEfficace: 'NO',
    ritmoPresentazione: '',
    inizioBlsd: null,
    inizioAcls: null,
    numeroShock: 0,
    dataOraRosc: null,
    percorsoEcmo: 'NO',
  };
}

export function emptyMsaDetails() {
  return {
    acc: emptyMsaAcc(),
    parametri: emptyMsaParametri(),
    farmaci: [],
    noteMsa: '',
    codiceColore: null,
    mezzoMsa: '',
  };
}

function toDate(raw) {
  if (!raw) return null;
  if (typeof raw?.toDate === 'function') return raw.toDate();
  if (raw instanceof Date) return raw;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toTimestamp(raw, fallback = null) {
  const d = toDate(raw);
  if (d) return Timestamp.fromDate(d);
  if (fallback instanceof Date) return Timestamp.fromDate(fallback);
  return fallback;
}

function siNo(raw) {
  return raw === 'SI' ? 'SI' : 'NO';
}

function clampNum(v, def, max = Infinity, min = -Infinity) {
  const x = Number(v);
  if (!Number.isFinite(x)) return def;
  if (max !== Infinity && x > max) return max;
  if (min !== -Infinity && x < min) return min;
  return Math.round(x * 1000) / 1000;
}

export function normalizeMsaParametri(raw) {
  const d = emptyMsaParametri();
  if (!raw || typeof raw !== 'object') return d;
  d.fr = clampNum(raw.fr, 12, Infinity, 0);
  d.spo2Aa = clampNum(raw.spo2Aa, 100, 100, 0);
  d.spo2O2 = clampNum(raw.spo2O2, 100, 100, 0);
  d.fc = clampNum(raw.fc, 70, Infinity, 0);
  d.paSis = clampNum(raw.paSis ?? raw.paSist, 120, Infinity, 0);
  d.paDia = clampNum(raw.paDia, 80, Infinity, 0);
  d.temperatura = clampNum(raw.temperatura, 37, 45, 30);
  const glicRaw = raw.glicemia;
  d.glicemia =
    glicRaw === null || glicRaw === undefined || glicRaw === ''
      ? null
      : clampNum(glicRaw, null, 800, 0);
  d.meccanicaRespiratoria = normalizeMeccanica(raw.meccanicaRespiratoria);
  d.cute = normalizeCute(raw.cute);
  d.gcs = clampNum(raw.gcs, 15, 15, 1);
  return d;
}

/** ACC attivo (campi visibili e valorizzabili). */
export function isMsaAccAttivo(raw) {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.attivo === true || raw.attivo === 'SI') return true;
  if (raw.attivo === false || raw.attivo === 'NO') return false;
  return Boolean(toTimestamp(raw.dataOraAcc));
}

export function normalizeMsaAcc(raw) {
  const d = emptyMsaAcc();
  if (!raw || typeof raw !== 'object') return d;
  d.attivo = isMsaAccAttivo(raw);
  d.dataOraAcc = toTimestamp(raw.dataOraAcc);
  d.testimoniato = siNo(raw.testimoniato);
  d.bystanderRcp = siNo(raw.bystanderRcp);
  d.bystanderInizio = toTimestamp(raw.bystanderInizio);
  d.bystanderEfficace = siNo(raw.bystanderEfficace);
  d.ritmoPresentazione = RITMO_PRESENTAZIONE_OPTS.includes(raw.ritmoPresentazione)
    ? raw.ritmoPresentazione
    : '';
  d.inizioBlsd = toTimestamp(raw.inizioBlsd);
  d.inizioAcls = toTimestamp(raw.inizioAcls);
  d.numeroShock = clampNum(raw.numeroShock, 0, 99, 0);
  d.dataOraRosc = toTimestamp(raw.dataOraRosc);
  d.percorsoEcmo = siNo(raw.percorsoEcmo);
  return d;
}

export function normalizeMsaDetails(raw) {
  if (!raw || typeof raw !== 'object') return emptyMsaDetails();
  const d = emptyMsaDetails();
  d.acc = normalizeMsaAcc(raw.acc);
  const parametri = normalizeMsaParametri(raw.parametri);
  if (raw.gcs != null && raw.parametri?.gcs == null) {
    parametri.gcs = clampNum(raw.gcs, 15, 15, 1);
  }
  d.parametri = parametri;
  d.farmaci = Array.isArray(raw.farmaci) ? raw.farmaci.map((f) => String(f ?? '')) : [];
  d.noteMsa = raw.noteMsa ?? '';
  const rawColore = String(raw.codiceColore ?? '').trim();
  d.codiceColore = DEFAULT_IMPOSTAZIONI.coloriEvento.includes(rawColore) ? rawColore : null;
  d.mezzoMsa = raw.mezzoMsa ?? '';
  return d;
}

/** Prima manovra tra BCPR bystander, BLSD, ACLS (timestamp più antico). */
export function firstRianimazioneStart(acc) {
  const times = [];
  if (acc?.bystanderRcp === 'SI') {
    const t = toDate(acc.bystanderInizio);
    if (t) times.push(t);
  }
  const blsd = toDate(acc?.inizioBlsd);
  if (blsd) times.push(blsd);
  const acls = toDate(acc?.inizioAcls);
  if (acls) times.push(acls);
  if (!times.length) return null;
  return new Date(Math.min(...times.map((t) => t.getTime())));
}

/** Minuti tra ACC e prima manovra di rianimazione. */
export function computeNoFlowMinutes(acc) {
  if (!isMsaAccAttivo(acc)) return null;
  const accTime = toDate(acc?.dataOraAcc);
  const first = firstRianimazioneStart(acc);
  if (!accTime || !first) return null;
  const diff = (first.getTime() - accTime.getTime()) / 60000;
  return Number.isFinite(diff) ? Math.round(diff) : null;
}

/** Minuti tra prima manovra e ROSC (vuoto se ROSC assente). */
export function computeLowFlowMinutes(acc) {
  if (!isMsaAccAttivo(acc)) return null;
  const first = firstRianimazioneStart(acc);
  const rosc = toDate(acc?.dataOraRosc);
  if (!first || !rosc) return null;
  const diff = (rosc.getTime() - first.getTime()) / 60000;
  return Number.isFinite(diff) ? Math.round(diff) : null;
}

export function formatFlowMinutes(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) return '—';
  return `${minutes} min`;
}

export function patchMsaParametri(msaDetails, parametriPartial) {
  return normalizeMsaDetails({
    ...msaDetails,
    parametri: { ...(msaDetails?.parametri ?? {}), ...parametriPartial },
  });
}

export function patchMsaAcc(msaDetails, accPartial) {
  return normalizeMsaDetails({
    ...msaDetails,
    acc: { ...(msaDetails?.acc ?? {}), ...accPartial },
  });
}
