import { DEFAULT_IMPOSTAZIONI } from '../constants';
import { vitalMeasuredOrNull } from './vitalNumeric';
import { emptyMsaAcc, normalizeMsaAcc } from './msaValutazione';
import { normalizeLesioni } from './valutazioneLesioni';
import { normalizeStringNameArray } from './valutazioneMsbMsaLists';

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
    fr: null,
    meccanicaRespiratoria: [],
    cute: [],
    spo2Aa: null,
    spo2O2: null,
    fc: null,
    paSis: null,
    paDia: null,
    temperatura: null,
    glicemia: null,
    app: '',
    lesioni: [],
    presidi: [],
    prestazioniMsb: [],
    descrizione: '',
    codiceColore: null,
    esitoMsb: 'Trasportato',
    esitoAltroMsb: '',
    mezzoMsb: '',
    ospedaleDestinazioneMsb: '',
    acc: emptyMsaAcc(),
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
  if (!Array.isArray(arr)) return [];
  const keys = [...new Set(arr.map(canonMr).filter(Boolean))];
  if (keys.length === 0) return [];
  if (keys.includes('ASSENTE')) return ['ASSENTE'];
  const paths = keys.filter((k) => MR_OPTIONS.find((o) => o.key === k)?.path);
  if (paths.length > 0) return [...paths].sort();
  if (keys.includes('Eupnoico')) return ['Eupnoico'];
  return [];
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
  d.fr = vitalMeasuredOrNull(raw.fr, { min: 0, integer: true });
  d.spo2Aa = vitalMeasuredOrNull(raw.spo2Aa, { min: 0, max: 100, integer: true });
  d.spo2O2 = vitalMeasuredOrNull(raw.spo2O2, { min: 0, max: 100, integer: true });
  d.fc = vitalMeasuredOrNull(raw.fc, { min: 0, integer: true });
  d.paSis = vitalMeasuredOrNull(raw.paSis ?? raw.paSist, { min: 0, integer: true });
  d.paDia = vitalMeasuredOrNull(raw.paDia, { min: 0, integer: true });
  d.temperatura = vitalMeasuredOrNull(raw.temperatura, { min: 30, max: 45 });
  d.glicemia = vitalMeasuredOrNull(raw.glicemia, { min: 0, max: 800, integer: true });
  d.app = raw.app ?? '';
  d.lesioni = normalizeLesioni(raw.lesioni);
  d.presidi = normalizeStringNameArray(raw.presidi);
  d.prestazioniMsb = normalizeStringNameArray(raw.prestazioniMsb);
  d.descrizione = raw.descrizione ?? '';
  const rawColore = String(raw.codiceColore ?? '').trim();
  d.codiceColore = DEFAULT_IMPOSTAZIONI.coloriEvento.includes(rawColore) ? rawColore : null;
  d.esitoMsb = ESITI_MSB.includes(raw.esitoMsb) ? raw.esitoMsb : 'Trasportato';
  d.esitoAltroMsb = raw.esitoAltroMsb ?? '';
  d.mezzoMsb = raw.mezzoMsb ?? '';
  d.ospedaleDestinazioneMsb = raw.ospedaleDestinazioneMsb ?? '';
  d.acc = normalizeMsaAcc(raw.acc);
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
