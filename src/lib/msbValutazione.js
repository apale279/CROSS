import { DEFAULT_IMPOSTAZIONI } from '../constants';

export const MR_OPTIONS = [
  { key: 'Eupnoico', path: false, absent: false },
  { key: 'ASSENTE', path: false, absent: true },
  { key: 'Tachipnoico', path: true, absent: false },
  { key: 'Dispnoico', path: true, absent: false },
  { key: 'Rumori', path: true, absent: false },
];

export const CUTE_OPTIONS = ['pallida', 'sudata', 'rosea', 'calda', 'cianotica'];

export const ESITI_MSB = ['Trasportato', 'Rifiuta trasporto', 'Si allontana', 'Altro'];

export function emptyMsbDetails() {
  return {
    avpu: 'A',
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
    app: '',
    descrizione: '',
    codiceColore: null,
    esitoMsb: 'Trasportato',
    esitoAltroMsb: '',
    mezzoMsb: '',
    ospedaleDestinazioneMsb: '',
  };
}

function canonMr(s) {
  const t = String(s).trim();
  const m = MR_OPTIONS.find((o) => o.key.toLowerCase() === t.toLowerCase());
  return m ? m.key : '';
}

function canonCute(s) {
  const t = String(s).trim().toLowerCase();
  return CUTE_OPTIONS.find((o) => o === t) ?? '';
}

export function normalizeMeccanica(arr) {
  if (!Array.isArray(arr)) return ['Eupnoico'];
  const keys = [...new Set(arr.map(canonMr).filter(Boolean))];
  if (keys.includes('ASSENTE')) return ['ASSENTE'];
  const paths = keys.filter((k) => MR_OPTIONS.find((o) => o.key === k)?.path);
  if (paths.length > 0) return [...paths].sort();
  return ['Eupnoico'];
}

export function normalizeCute(arr) {
  if (!Array.isArray(arr)) return [];
  const keys = [...new Set(arr.map(canonCute).filter(Boolean))];
  return CUTE_OPTIONS.filter((k) => keys.includes(k));
}

export function normalizeMsbDetails(raw) {
  if (!raw || typeof raw !== 'object') return emptyMsbDetails();
  const d = emptyMsbDetails();
  const av = raw.avpu ?? raw.AVPU;
  if (['A', 'V', 'P', 'U'].includes(av)) d.avpu = av;
  const clampNum = (v, def, max = Infinity, min = -Infinity) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return def;
    if (max !== Infinity && x > max) return max;
    if (min !== -Infinity && x < min) return min;
    return Math.round(x * 1000) / 1000;
  };
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
  d.app = raw.app ?? '';
  d.descrizione = raw.descrizione ?? '';
  const rawColore = String(raw.codiceColore ?? '').trim();
  d.codiceColore = DEFAULT_IMPOSTAZIONI.coloriEvento.includes(rawColore) ? rawColore : null;
  d.esitoMsb = ESITI_MSB.includes(raw.esitoMsb) ? raw.esitoMsb : 'Trasportato';
  d.esitoAltroMsb = raw.esitoAltroMsb ?? '';
  d.mezzoMsb = raw.mezzoMsb ?? '';
  d.ospedaleDestinazioneMsb = raw.ospedaleDestinazioneMsb ?? '';
  d.meccanicaRespiratoria = normalizeMeccanica(raw.meccanicaRespiratoria);
  d.cute = normalizeCute(raw.cute);
  return d;
}

/** Click su opzione meccanica: ASSENTE ed Eupnoico esclusivi; patologie escludono entrambi. */
export function toggleMeccanica(current, key) {
  const opt = MR_OPTIONS.find((o) => o.key === key);
  if (!opt) return current;

  if (opt.absent) {
    const sel = new Set(current ?? []);
    return sel.has('ASSENTE') ? ['Eupnoico'] : ['ASSENTE'];
  }

  if (!opt.path) {
    return ['Eupnoico'];
  }

  const sel = new Set(current ?? []);
  sel.delete('Eupnoico');
  sel.delete('ASSENTE');
  if (sel.has(key)) {
    sel.delete(key);
  } else {
    sel.add(key);
  }

  const arr = [...sel].filter((k) => MR_OPTIONS.some((o) => o.key === k));
  const paths = arr.filter((k) => MR_OPTIONS.find((o) => o.key === k)?.path);
  if (paths.length === 0) return ['Eupnoico'];
  return paths.sort();
}

/** Multiselect CUTE: più voci contemporanee. */
export function toggleCute(current, key) {
  if (!CUTE_OPTIONS.includes(key)) return normalizeCute(current);
  const sel = new Set(normalizeCute(current));
  if (sel.has(key)) sel.delete(key);
  else sel.add(key);
  return CUTE_OPTIONS.filter((k) => sel.has(k));
}
