import { DEFAULT_IMPOSTAZIONI } from '../constants';

export const MR_OPTIONS = [
  { key: 'Eupnoico', path: false },
  { key: 'Tachipnoico', path: true },
  { key: 'Dispnoico', path: true },
  { key: 'Rumori', path: true },
];

export const ESITI_MSB = ['Trasportato', 'Rifiuta trasporto', 'Si allontana', 'Altro'];

export function emptyMsbDetails() {
  return {
    avpu: 'A',
    fr: 12,
    meccanicaRespiratoria: ['Eupnoico'],
    spo2Aa: 100,
    spo2O2: 100,
    fc: 70,
    paSis: 120,
    paDia: 80,
    app: '',
    descrizione: '',
    codiceColore: 'Bianco',
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

export function normalizeMeccanica(arr) {
  if (!Array.isArray(arr)) return ['Eupnoico'];
  const keys = [...new Set(arr.map(canonMr).filter(Boolean))];
  const paths = keys.filter((k) => MR_OPTIONS.find((o) => o.key === k)?.path);
  if (paths.length > 0) return [...paths].sort();
  return ['Eupnoico'];
}
export function normalizeMsbDetails(raw) {
  if (!raw || typeof raw !== 'object') return emptyMsbDetails();
  const d = emptyMsbDetails();
  const av = raw.avpu ?? raw.AVPU;
  if (['A', 'V', 'P', 'U'].includes(av)) d.avpu = av;
  const clampNum = (v, def, max = Infinity) => {
    const x = Number(v);
    if (!Number.isFinite(x)) return def;
    return max !== Infinity && x > max ? max : x < 0 ? 0 : Math.round(x * 1000) / 1000;
  };
  d.fr = clampNum(raw.fr, 12);
  d.spo2Aa = clampNum(raw.spo2Aa, 100, 100);
  d.spo2O2 = clampNum(raw.spo2O2, 100, 100);
  d.fc = clampNum(raw.fc, 70);
  d.paSis = clampNum(raw.paSis ?? raw.paSist, 120);
  d.paDia = clampNum(raw.paDia, 80);
  d.app = raw.app ?? '';
  d.descrizione = raw.descrizione ?? '';
  d.codiceColore = DEFAULT_IMPOSTAZIONI.coloriEvento.includes(raw.codiceColore)
    ? raw.codiceColore
    : 'Bianco';
  d.esitoMsb = ESITI_MSB.includes(raw.esitoMsb) ? raw.esitoMsb : 'Trasportato';
  d.esitoAltroMsb = raw.esitoAltroMsb ?? '';
  d.mezzoMsb = raw.mezzoMsb ?? '';
  d.ospedaleDestinazioneMsb = raw.ospedaleDestinazioneMsb ?? '';
  d.meccanicaRespiratoria = normalizeMeccanica(raw.meccanicaRespiratoria);
  return d;
}

/** Click su opzione meccanica: Eupnoico esclusivo; patologie escludono Eupnoico. */
export function toggleMeccanica(current, key) {
  const sel = new Set(current);
  const opt = MR_OPTIONS.find((o) => o.key === key);
  if (!opt) return current;

  if (!opt.path) {
    return ['Eupnoico'];
  }

  sel.delete('Eupnoico');
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
