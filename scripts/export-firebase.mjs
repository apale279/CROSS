/**
 * CROSS — Export Firebase → CSV + HTML Viewer + Report PDF
 * ─────────────────────────────────────────────────────────
 * Legge credenziali e tenant da .env.local automaticamente.
 * Doppio clic su esporta-dati.bat per avviare.
 *
 * Output → ./Dati esportati_local/YYYYMMDD-HHmmss/
 *   eventi.csv  missioni.csv  mezzi.csv  pazienti.csv  valutazioni.csv
 *   json/*.json  (dump Firestore completo)
 *   viewer.html
 *   reports/evento_E1.html  reports/paziente_P1.html  …
 */

import { createRequire } from 'module';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── Parser .env.local ────────────────────────────────────────────────────────
function parseEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  const lines = readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    // Rimuovi virgolette esterne se presenti
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const ENV = parseEnvFile(join(ROOT, '.env.local'));

// ─── Carica firebase-admin ────────────────────────────────────────────────────
let admin;
try {
  admin = require('firebase-admin');
} catch {
  console.error('\n❌  firebase-admin non trovato.');
  console.error('   Esegui: npm install  nella cartella CROSS\n');
  process.exit(1);
}

// ─── Service account ──────────────────────────────────────────────────────────
let serviceAccount;

// 1) Prova FIREBASE_SERVICE_ACCOUNT_JSON da .env.local
if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    serviceAccount = JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log('🔑  Credenziali lette da .env.local');
  } catch (e) {
    console.error('❌  FIREBASE_SERVICE_ACCOUNT_JSON in .env.local non è JSON valido:', e.message);
  }
}

// 2) Fallback: file JSON nella root
if (!serviceAccount) {
  const candidates = [
    join(ROOT, 'cross-8bb72-firebase-adminsdk-fbsvc-fc15d3e3a9.json'),
    ...require('fs').readdirSync(ROOT)
      .filter(f => f.includes('firebase-adminsdk') && f.endsWith('.json'))
      .map(f => join(ROOT, f)),
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      try { serviceAccount = JSON.parse(readFileSync(p, 'utf8')); console.log(`🔑  Credenziali lette da ${p}`); break; }
      catch {}
    }
  }
}

if (!serviceAccount) {
  console.error('\n❌  Nessun service account trovato.');
  console.error('   Aggiungi FIREBASE_SERVICE_ACCOUNT_JSON in .env.local\n');
  process.exit(1);
}

// ─── Tenant ID ────────────────────────────────────────────────────────────────
const TENANT_ID_ENV = (ENV.VITE_TENANT_ID || '').trim();

// ─── Init Firebase ────────────────────────────────────────────────────────────
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ─── Utility ──────────────────────────────────────────────────────────────────
function tsStr(val) {
  if (!val) return '';
  if (val && typeof val === 'object' && val._seconds !== undefined)
    return new Date(val._seconds * 1000).toLocaleString('it-IT');
  if (val && typeof val.toDate === 'function')
    return val.toDate().toLocaleString('it-IT');
  return '';
}

function flatVal(val) {
  if (val === null || val === undefined) return '';
  if (val && typeof val === 'object' && (val._seconds !== undefined || typeof val.toDate === 'function'))
    return tsStr(val);
  if (Array.isArray(val))
    return val.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v ?? ''))).join(' | ');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function escCsv(v) {
  const s = flatVal(v);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsvOrdered(rows, priorityCols) {
  if (!rows.length) return '';
  const all = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const front = priorityCols.filter(c => all.includes(c));
  const rest = all.filter(c => !priorityCols.includes(c));
  const cols = [...front, ...rest];
  return [cols.join(','), ...rows.map(r => cols.map(c => escCsv(r[c])).join(','))].join('\n');
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const COLORE_BG = { bianco:'#e8e8e8',Bianco:'#e8e8e8',verde:'#4caf50',Verde:'#4caf50',giallo:'#f9a825',Giallo:'#f9a825',rosso:'#d32f2f',Rosso:'#d32f2f',nero:'#212121',Nero:'#212121' };
const COLORE_FG = { bianco:'#333',Bianco:'#333',verde:'#fff',Verde:'#fff',giallo:'#333',Giallo:'#333',rosso:'#fff',Rosso:'#fff',nero:'#fff',Nero:'#fff' };

function coloreBadge(c) {
  if (!c) return '';
  const bg = COLORE_BG[c] || '#ccc', fg = COLORE_FG[c] || '#333';
  return `<span style="display:inline-block;padding:2px 9px;border-radius:10px;background:${bg};color:${fg};font-weight:700;font-size:11px;border:1px solid rgba(0,0,0,.15)">${esc(c)}</span>`;
}

function fld(label, value) {
  const v = (value !== null && value !== undefined && String(value).trim() !== '')
    ? esc(String(value))
    : `<span style="color:#aaa">—</span>`;
  return `<div class="field"><div class="lbl">${label}</div><div class="val">${v}</div></div>`;
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchAll(tenantId, colName) {
  const snap = await db.collection('manifestazioni').doc(tenantId).collection(colName).get();
  return snap.docs.map(d => ({ _docId: d.id, ...d.data() }));
}

function flattenMezzoForCsv(m) {
  const s = m.stazionamento ?? {};
  const pr = m.posizioneReale?.coordinate;
  return {
    ...m,
    stazione_indirizzo: s.indirizzo ?? '',
    stazione_luogo_fisico: s.luogo_fisico ?? '',
    posizioneReale_lat: pr?.lat ?? pr?._lat ?? '',
    posizioneReale_lng: pr?.lng ?? pr?._long ?? '',
  };
}

async function fetchValutazioni(tenantId, pazienti) {
  const CHUNK = 20;
  const all = [];
  for (let i = 0; i < pazienti.length; i += CHUNK) {
    const chunk = pazienti.slice(i, i + CHUNK);
    const results = await Promise.all(chunk.map(async pz => {
      const snap = await db
        .collection('manifestazioni').doc(tenantId)
        .collection('pazienti').doc(pz._docId)
        .collection('valutazioniSoccorso').get();
      return snap.docs.map(d => ({
        _docId: d.id,
        pazienteDocId: pz._docId,
        pazienteId: pz.idPaziente || '',
        pettorale: pz.pettorale ?? '',
        nome: pz.nome ?? '',
        cognome: pz.cognome ?? '',
        ...d.data(),
      }));
    }));
    all.push(...results.flat());
  }
  return all;
}

async function selectTenant() {
  const snap = await db.collection('manifestazioni').get();
  if (snap.empty) { console.error('\n❌  Nessun documento in /manifestazioni'); process.exit(1); }

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Usa tenant da .env.local se presente e valido
  if (TENANT_ID_ENV) {
    const found = docs.find(d => d.id === TENANT_ID_ENV);
    if (found) {
      console.log(`✅  Tenant da .env.local: ${found.id} (${found.nome ?? ''})`);
      return found.id;
    }
  }

  // Auto-selezione se unico
  if (docs.length === 1) {
    console.log(`✅  Tenant rilevato: ${docs[0].id} (${docs[0].nome ?? ''})`);
    return docs[0].id;
  }

  // Richiede input solo se multiplo e non in env
  const { createInterface } = await import('readline');
  console.log('\nManifestazioni disponibili:');
  docs.forEach((d, i) => console.log(`  ${i+1}. ${d.id}  —  ${d.nome ?? ''}`));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = await new Promise(res => rl.question(`\nScegli (1–${docs.length}): `, a => { rl.close(); res(a.trim()); }));
  const idx = parseInt(ans, 10) - 1;
  if (isNaN(idx) || idx < 0 || idx >= docs.length) { console.error('❌  Scelta non valida'); process.exit(1); }
  return docs[idx].id;
}

// ─── Export completo: serializzazione Firestore → CSV / JSON ─────────────────
const MISSION_STATI_ORDER = [
  'ALLERTARE', 'ALLERTATO', 'PARTITO', 'IN POSTO', 'DIRETTO H',
  'ARRIVATO H', 'RIENTRO', 'FINE MISSIONE', 'ANNULLATA',
];

function storicoColName(statoKey) {
  return 'storico_' + String(statoKey).replace(/\s+/g, '_');
}

function serializeForExportNode(value, seen = new WeakSet()) {
  if (value == null) return null;
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (typeof value._seconds === 'number')
    return new Date(value._seconds * 1000).toISOString();
  if (typeof value.toDate === 'function') {
    try { return value.toDate().toISOString(); } catch { return null; }
  }
  if (Array.isArray(value)) {
    seen.add(value);
    return value.map(v => serializeForExportNode(v, seen));
  }
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  seen.add(value);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = serializeForExportNode(v, seen);
  }
  return out;
}

function cellSerializeNode(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(serializeForExportNode(value));
  return String(value);
}

function expandStoricoStatiColumns(storico) {
  const out = {};
  if (!storico || typeof storico !== 'object') return out;
  for (const k of MISSION_STATI_ORDER) {
    if (storico[k] != null) out[storicoColName(k)] = tsStr(storico[k]);
  }
  for (const [k, v] of Object.entries(storico)) {
    const col = storicoColName(k);
    if (!out[col]) out[col] = tsStr(v);
  }
  return out;
}

function formatStoricoStatiInline(storico) {
  if (!storico || typeof storico !== 'object') return '—';
  const parts = [];
  for (const k of MISSION_STATI_ORDER) {
    if (storico[k] != null) parts.push(`${k}: ${tsStr(storico[k])}`);
  }
  for (const [k, v] of Object.entries(storico)) {
    if (!MISSION_STATI_ORDER.includes(k)) parts.push(`${k}: ${tsStr(v)}`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function docToFullCsvRow(doc) {
  const row = { _docId: doc._docId };
  for (const [key, value] of Object.entries(doc)) {
    if (key === '_docId') continue;
    if (key === 'pmaScheda') {
      row.pmaScheda_json = cellSerializeNode(value ?? {});
      continue;
    }
    if (key === 'codiceMinore') {
      row.codiceMinore_json = cellSerializeNode(value ?? {});
      continue;
    }
    if (key === 'storicoStati') {
      Object.assign(row, expandStoricoStatiColumns(value));
      row.storicoStati_json = cellSerializeNode(value ?? {});
      continue;
    }
    if (key === 'msbDetails') {
      row.msbDetails_json = cellSerializeNode(value ?? null);
      continue;
    }
    if (key === 'msaDetails') {
      row.msaDetails_json = cellSerializeNode(value ?? null);
      continue;
    }
    if (key === 'tratteMissione') {
      row.tratteMissione_json = cellSerializeNode(value ?? []);
      continue;
    }
    if (key === 'stazionamento') {
      row.stazionamento_json = cellSerializeNode(value ?? {});
      continue;
    }
    if (key === 'posizioneReale') {
      row.posizioneReale_json = cellSerializeNode(value ?? null);
      continue;
    }
    if (key === 'pazienteRiferimento') {
      row.pazienteRiferimento_json = cellSerializeNode(value ?? null);
      continue;
    }
    row[key] = flatVal(value);
  }
  return row;
}

function flattenMezzoFullCsv(m) {
  const s = m.stazionamento ?? {};
  const pr = m.posizioneReale?.coordinate ?? m.posizioneReale ?? {};
  const row = docToFullCsvRow(m);
  row.stazione_indirizzo = s.indirizzo ?? '';
  row.stazione_luogo_fisico = s.luogo_fisico ?? '';
  row.posizioneReale_lat = pr?.lat ?? pr?._lat ?? '';
  row.posizioneReale_lng = pr?.lng ?? pr?._long ?? pr?.longitude ?? '';
  return row;
}

function flattenPazienteFullCsv(p) {
  const row = docToFullCsvRow(p);
  row.codiceColoreSanitario_export = pazienteColoreExport(p);
  return row;
}

// ─── CSV legacy: appiattisce pmaScheda (solo riepilogo) ───────────────────────
function pazienteColoreExport(p) {
  const san = String(p?.codiceColoreSanitario ?? p?.codiceColore ?? '').trim();
  if (san) return san;
  const raw = String(p?.pmaScheda?.codice_colore ?? '').trim().toLowerCase();
  const map = { bianco: 'Bianco', verde: 'Verde', giallo: 'Giallo', rosso: 'Rosso' };
  return map[raw] || raw;
}

function flattenPazienteForCsv(p) {
  const { pmaScheda, ...rest } = p;
  return {
    ...rest,
    ...flattenPmaScheda(pmaScheda),
    codiceColoreSanitario: pazienteColoreExport(p),
  };
}

function flattenPmaScheda(scheda) {
  if (!scheda || typeof scheda !== 'object') return {};
  const flat = {};
  const ARRAY_KEYS = ['parametri_vitali','farmaci','rivalutazioni','lesioni','prestazioni_sel',
    'EO_GENERALE','EO_NEUROLOGICO','EO_CUTE','EO_TORACE','EO_ADDOME','EO_CAPO_COLLO'];
  for (const [k, v] of Object.entries(scheda)) {
    if (['firma_paziente_base64','dimissione_firma_medico_base64'].includes(k)) continue;
    if (ARRAY_KEYS.includes(k)) {
      flat[`pma_${k}_n`] = Array.isArray(v) ? v.length : 0;
    } else {
      flat[`pma_${k}`] = flatVal(v);
    }
  }
  // Ultimi parametri vitali (riga più recente)
  if (Array.isArray(scheda.parametri_vitali) && scheda.parametri_vitali.length) {
    const last = [...scheda.parametri_vitali].sort((a,b)=>(b.registrato_at?._seconds??0)-(a.registrato_at?._seconds??0))[0];
    flat['pma_ultimi_parametri'] = `GCS:${last.gcs??'?'} FC:${last.fc??'?'} PA:${last.pa_sistolica??'?'}/${last.pa_diastolica??'?'} SpO2:${last.spo2_aa??'?'} FR:${last.fr??'?'} T:${last.temperatura??'?'}`;
    flat['pma_ultimi_parametri_ore'] = tsStr(last.registrato_at);
  }
  if (Array.isArray(scheda.farmaci) && scheda.farmaci.length)
    flat['pma_farmaci_lista'] = scheda.farmaci.map(f=>`${f.nome??''}${f.dose?' '+f.dose:''}`).join(' | ');
  return flat;
}

// ─── HTML comune ──────────────────────────────────────────────────────────────
const PDF_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',Arial,sans-serif;font-size:11pt;color:#1a1a1a;background:#fff;line-height:1.45}
.page{max-width:210mm;margin:0 auto;padding:12mm 14mm}
h1{font-size:15pt;font-weight:700;color:#1a237e;border-bottom:3px solid #1a237e;padding-bottom:3mm;margin-bottom:5mm}
h2{font-size:11.5pt;font-weight:600;color:#283593;margin:5mm 0 2mm;border-left:4px solid #3949ab;padding-left:3mm}
h3{font-size:10pt;font-weight:600;color:#37474f;margin:3mm 0 1mm}
.hrow{display:flex;justify-content:space-between;align-items:flex-start;gap:4mm;margin-bottom:5mm}
.hright{text-align:right;font-size:9pt;color:#555;line-height:1.6}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:3mm}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:2mm}
.field{margin-bottom:2mm}
.field .lbl{font-size:7.5pt;font-weight:600;color:#546e7a;text-transform:uppercase;letter-spacing:.3px}
.field .val{font-size:10pt;color:#1a1a1a;border-bottom:1px solid #e8e8e8;padding-bottom:1mm;min-height:5.5mm}
table{width:100%;border-collapse:collapse;margin:2mm 0 4mm;font-size:9pt}
th{background:#3949ab;color:#fff;padding:2.5mm 3mm;text-align:left;font-weight:600}
td{padding:2mm 3mm;border-bottom:1px solid #eeeeee;vertical-align:top}
tr:nth-child(even) td{background:#f8f9ff}
tr:last-child td{border-bottom:none}
.box{background:#f5f7ff;border:1px solid #c5cae9;border-radius:4px;padding:3mm 4mm;margin:2mm 0 4mm}
.tag{display:inline-block;background:#e8eaf6;color:#3949ab;border-radius:3px;padding:1px 7px;font-size:9pt;margin:1px 2px 1px 0}
.nd{color:#bbb;font-style:italic;font-size:9pt}
.footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #ddd;font-size:8pt;color:#999;display:flex;justify-content:space-between}
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(75px,1fr));gap:3mm;margin:3mm 0 5mm}
.stat-card{background:#f5f7ff;border:1px solid #c5cae9;border-radius:4px;padding:3mm;text-align:center}
.stat-card .num{font-size:21pt;font-weight:800;color:#1a237e;line-height:1.1}
.stat-card .lbl{font-size:7.5pt;color:#555;margin-top:1mm}
.r .num{color:#c62828}.g .num{color:#2e7d32}.y .num{color:#e65100}
.pbtn{position:fixed;bottom:18px;right:18px;background:#1a237e;color:#fff;border:none;
  padding:9px 18px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;
  box-shadow:0 3px 10px rgba(0,0,0,.3);z-index:999}
.pbtn:hover{background:#283593}
@media print{
  .pbtn{display:none!important}
  .page{padding:8mm 10mm;max-width:none}
  h2{break-after:avoid}
  table{break-inside:auto}
  tr{break-inside:avoid}
}`;

// ─── Scheda Paziente HTML ─────────────────────────────────────────────────────
function buildPazienteHtml(pz, valutazioni, exportDate) {
  const scheda = pz.pmaScheda || {};
  const idVis = pz.idPaziente || pz._docId;
  const nome  = [pz.nome, pz.cognome].filter(Boolean).join(' ') || '—';
  const colore = pazienteColoreExport(pz);

  // Parametri vitali
  const pvList = [...(Array.isArray(scheda.parametri_vitali) ? scheda.parametri_vitali : [])]
    .sort((a,b)=>(a.registrato_at?._seconds??0)-(b.registrato_at?._seconds??0));
  const pvRows = pvList.length ? pvList.map(r=>`<tr>
    <td>${tsStr(r.registrato_at)||'—'}</td><td>${esc(r.operatore_nome||'—')}</td>
    <td><b>${r.gcs??'—'}</b></td><td>${r.fr??'—'}</td><td>${r.spo2_aa??'—'}</td>
    <td>${r.spo2_o2??'—'}</td><td>${r.fc??'—'}</td>
    <td>${r.pa_sistolica??'—'}/${r.pa_diastolica??'—'}</td>
    <td>${r.temperatura??'—'}</td><td>${r.nrs??'—'}</td></tr>`).join('')
    : `<tr><td colspan="10" class="nd" style="text-align:center;padding:4mm">Nessun parametro registrato</td></tr>`;

  // Farmaci
  const farmList = [...(Array.isArray(scheda.farmaci) ? scheda.farmaci : [])]
    .sort((a,b)=>(a.registrato_at?._seconds??0)-(b.registrato_at?._seconds??0));
  const farmRows = farmList.length ? farmList.map(f=>`<tr>
    <td>${tsStr(f.registrato_at)||'—'}</td><td><b>${esc(f.nome||'—')}</b></td>
    <td>${esc(f.dose||'—')}</td><td>${esc(f.via||'—')}</td></tr>`).join('')
    : `<tr><td colspan="4" class="nd" style="text-align:center;padding:4mm">Nessun farmaco somministrato</td></tr>`;

  // Rivalutazioni
  const rivList = [...(Array.isArray(scheda.rivalutazioni) ? scheda.rivalutazioni : [])]
    .sort((a,b)=>(a.creato_at?._seconds??0)-(b.creato_at?._seconds??0));
  const rivRows = rivList.length ? rivList.map(r=>`<tr>
    <td>${tsStr(r.creato_at)||'—'}</td><td>${esc(r.firma_nome||'—')}</td>
    <td style="white-space:pre-wrap">${esc(r.testo||'—')}</td></tr>`).join('')
    : `<tr><td colspan="3" class="nd" style="text-align:center;padding:4mm">Nessuna rivalutazione</td></tr>`;

  // EO rapido
  const eoMap = {EO_GENERALE:'Generale',EO_NEUROLOGICO:'Neurologico',EO_CUTE:'Cute',EO_TORACE:'Torace',EO_ADDOME:'Addome',EO_CAPO_COLLO:'Capo/Collo'};
  const eoHtml = Object.entries(eoMap).map(([k,l])=>{
    const arr = Array.isArray(scheda[k]) ? scheda[k] : [];
    return arr.length ? `<div style="margin-bottom:2mm"><b>${l}:</b> ${arr.map(v=>`<span class="tag">${esc(v)}</span>`).join('')}</div>` : '';
  }).join('') || `<span class="nd">Non compilato</span>`;

  // Prestazioni
  const prestHtml = (Array.isArray(scheda.prestazioni_sel) && scheda.prestazioni_sel.length)
    ? scheda.prestazioni_sel.map(p=>`<span class="tag">${esc(p)}</span>`).join('')
    : `<span class="nd">Nessuna</span>`;

  // Lesioni
  const lesHtml = (Array.isArray(scheda.lesioni) && scheda.lesioni.length)
    ? scheda.lesioni.sort((a,b)=>a.n-b.n).map(l=>`<div class="field"><span class="tag">#${l.n} ${l.vista==='front'?'Fronte':'Retro'}</span> ${esc(l.descrizione||'—')}</div>`).join('')
    : `<span class="nd">Nessun marker lesioni</span>`;

  // Valutazioni soccorso
  const valHtml = valutazioni.length ? valutazioni.map(v=>{
    const tipo = v.tipo || 'MSB';
    const det  = tipo === 'MSA' ? v.msaDetails : v.msbDetails;
    const par  = det?.parametri || det || {};
    return `<div class="box" style="margin-bottom:3mm">
      <h3>${tipo==='MSA'?'🚨 MSA — Supporto Avanzato':'🚑 MSB — Supporto Base'}
        &nbsp;${tsStr(v.creatoIl)||'—'}&nbsp;${coloreBadge(det?.codiceColore||'')}
        ${v.mezzo||det?.mezzoMsa||det?.mezzoMsb?`<span style="font-size:9pt;font-weight:400;margin-left:6px">Mezzo: <b>${esc(v.mezzo||det?.mezzoMsa||det?.mezzoMsb||'')}</b></span>`:''}
      </h3>
      <div class="g4" style="margin-top:2mm">
        ${tipo==='MSB'?fld('AVPU',det?.avpu||''):''}
        ${fld('GCS',par.gcs??'')} ${fld('FC',par.fc??'')}
        ${fld('PA',par.paSis?`${par.paSis}/${par.paDia}`:'')}
        ${fld('SpO₂ aa',par.spo2Aa??'')} ${fld('SpO₂ O₂',par.spo2O2??'')}
        ${fld('FR',par.fr??'')} ${fld('T°C',par.temperatura??'')}
        ${fld('Glicemia',par.glicemia!=null?par.glicemia:'')}
      </div>
      ${v.testo?`<div class="field" style="margin-top:2mm"><div class="lbl">Note</div><div class="val" style="white-space:pre-wrap">${esc(v.testo)}</div></div>`:''}
      ${det?.descrizione?`<div class="field"><div class="lbl">Descrizione</div><div class="val">${esc(det.descrizione)}</div></div>`:''}
      ${det?.app?`<div class="field"><div class="lbl">APP</div><div class="val">${esc(det.app)}</div></div>`:''}
      ${tipo==='MSA'&&det?.acc?.dataOraAcc?`<div style="margin-top:2mm;padding:2mm;background:#fff3e0;border-radius:3px;font-size:9pt">
        <b>Arresto Cardiaco:</b> ${tsStr(det.acc.dataOraAcc)||'—'} — Testimoniato: ${det.acc.testimoniato||'—'} — ROSC: ${tsStr(det.acc.dataOraRosc)||'assente'} — Shock: ${det.acc.numeroShock??'—'}
      </div>`:''}
      ${det?.farmaci?.length?`<div style="margin-top:2mm;font-size:9pt"><b>Farmaci:</b> ${det.farmaci.map(f=>esc(f)).join(', ')}</div>`:''}
    </div>`;
  }).join('') : `<p class="nd">Nessuna valutazione soccorritore</p>`;

  const esitoLabel = {dimesso:'Dimesso',invio_ps:'Invio in PS',rifiuta_invio_ps:'Rifiuto invio PS',riaffidato:'Riaffidato',deceduto:'Deceduto',si_allontana:'Si allontana'}[scheda.dimissione_esito] || scheda.dimissione_esito || '—';

  const hasPma = scheda && Object.keys(scheda).some(k => scheda[k] !== null && scheda[k] !== '' && scheda[k] !== undefined && !(Array.isArray(scheda[k]) && scheda[k].length === 0));

  return `<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scheda ${esc(idVis)} — ${esc(nome)}</title>
<style>${PDF_CSS}</style></head><body>
<button class="pbtn" onclick="window.print()">🖨️ Stampa / PDF</button>
<div class="page">
  <div class="hrow">
    <div>
      <h1>🏥 Scheda Paziente CROSS</h1>
      <div style="font-size:12pt;margin-top:2mm">
        ID: <b>${esc(idVis)}</b> &nbsp;|&nbsp;
        Pettorale: <b>${esc(String(pz.pettorale??'—'))}</b> &nbsp;|&nbsp;
        ${coloreBadge(colore)}
      </div>
      <div style="font-size:10pt;margin-top:1mm;color:#37474f">
        Tipo: <b>${esc(pz.tipoPz||'CENTRALE')}</b>
        &nbsp;|&nbsp; Stato Centrale: <b>${esc(pz.stato||'—')}</b>
        ${pz.statoPzPma?` &nbsp;|&nbsp; PMA: <b>${esc(pz.statoPzPma)}</b>`:''}
        ${pz.pmaId||pz.destinazionePmaId?` &nbsp;|&nbsp; PMA dest.: <b>${esc(pz.destinazionePmaId||pz.pmaId||'—')}</b>`:''}
      </div>
    </div>
    <div class="hright">
      Evento: <b>${esc(pz.eventoCorrelato||'—')}</b><br>
      Mezzo: <b>${esc(pz.mezzo||'—')}</b><br>
      Esito: <b>${esc(pz.esito||'—')}</b><br>
      ${pz.ospedaleDestinazione?`Ospedale: <b>${esc(pz.ospedaleDestinazione)}</b><br>`:''}
      <span style="font-size:8pt;color:#aaa">Export: ${esc(exportDate)}</span>
    </div>
  </div>

  <h2>Dati anagrafici</h2>
  <div class="g3">
    ${fld('Nome',pz.nome||'')} ${fld('Cognome',pz.cognome||'')} ${fld('Pettorale',pz.pettorale!=null?String(pz.pettorale):'')}
    ${fld('Età',pz.eta!=null?`${pz.eta} anni`:'')} ${fld('Sesso',pz.sesso||'')} ${fld('Data nascita',tsStr(pz.dataNascita)||'')}
    ${fld('Codice fiscale',pz.codice_fiscale||'')} ${fld('Telefono',pz.telefono||'')} ${fld('Email',pz.email||'')}
  </div>
  ${pz.notePaziente?`<div class="field"><div class="lbl">Note Centrale</div><div class="val" style="white-space:pre-wrap">${esc(pz.notePaziente)}</div></div>`:''}

  <h2>Evento / Missione</h2>
  <div class="g3">
    ${fld('Evento',pz.eventoCorrelato||'')} ${fld('Missione',pz.idMissione||'')} ${fld('Mezzo',pz.mezzo||'')}
    ${fld('Ospedale destinazione',pz.ospedaleDestinazione||'')} ${fld('Esito',pz.esito||'')} ${fld('Arrivato H',tsStr(pz.arrivatoHAt)||'')}
  </div>

  ${(() => {
    const cm = pz.codiceMinore || {};
    const hasCm = pz.tipoPz === 'CODICE MINORE' || Object.keys(cm).some(k => cm[k] != null && cm[k] !== '');
    if (!hasCm) return '';
    const foto = Array.isArray(cm.foto) ? cm.foto : [];
    return `
  <h2>Codice minore (astanteria PMA)</h2>
  <div class="g3">
    ${fld('Motivo arrivo', cm.motivoArrivo || '')}
    ${fld('Trattamento', cm.trattamento || '')}
    ${fld('Da trasporto centrale', cm.daTrasportoCentrale ? 'SÌ' : 'NO')}
    ${fld('Ora arrivo', tsStr(cm.oraArrivo) || '')}
    ${fld('Ora fine', tsStr(cm.oraFine) || '')}
    ${fld('Provenienza trasporto', cm.provenienzaTrasporto || '')}
  </div>
  ${foto.length ? `<h3>Foto (${foto.length})</h3><div class="g2">${foto.map((f, i) => `
    <div class="field"><div class="lbl">Foto ${i + 1}</div><div class="val">${esc(f.nome || f.id || '—')}${f.url ? ` — ${esc(f.url)}` : ''}</div></div>
  `).join('')}</div>` : ''}`;
  })()}

  ${hasPma ? `
  <h2>Cartella clinica PMA</h2>
  <div class="g3">
    ${fld('Tipo evento',scheda.tipo_evento||'')} ${fld('Dettaglio',scheda.dettaglio_evento||'')} ${fld('Breve descrizione',scheda.breve_descrizione||'')}
  </div>
  <div class="g2">
    ${fld('APR',scheda.apr||'')} ${fld('APP',scheda.app||'')}
    ${fld('Allergie verificate',{si:'SÌ',no:'NO',non_noto:'NON NOTO'}[scheda.allergie_verifica]||'')} ${fld('Allergie',scheda.allergie||'')}
  </div>
  ${scheda.eo_note?`<div class="field"><div class="lbl">Note EO</div><div class="val" style="white-space:pre-wrap">${esc(scheda.eo_note)}</div></div>`:''}
  <h3>Esame obiettivo rapido</h3>
  <div class="box" style="padding:2mm 3mm">${eoHtml}</div>
  <h3>Parametri vitali</h3>
  <table><thead><tr><th>Data/ora</th><th>Operatore</th><th>GCS</th><th>FR</th><th>SpO₂ aa</th><th>SpO₂ O₂</th><th>FC</th><th>PA</th><th>T°C</th><th>NRS</th></tr></thead>
  <tbody>${pvRows}</tbody></table>
  <h3>Prestazioni</h3>
  <div class="box" style="padding:2mm 3mm">${prestHtml}</div>
  <h3>Farmaci somministrati</h3>
  <table><thead><tr><th>Data/ora</th><th>Farmaco</th><th>Dose</th><th>Via</th></tr></thead><tbody>${farmRows}</tbody></table>
  <h3>Rivalutazioni</h3>
  <table><thead><tr><th>Data/ora</th><th>Firma</th><th>Nota</th></tr></thead><tbody>${rivRows}</tbody></table>
  <h3>Lesioni</h3>
  <div class="box" style="padding:2mm 3mm">${lesHtml}</div>
  <h2>Dimissione</h2>
  <div class="g3">
    ${fld('Esito',esitoLabel)} ${fld('Dimesso il',tsStr(scheda.dimesso_at)||'')} ${fld('Medico rif.',scheda.medico_rif||'')}
  </div>
  ${scheda.dimissione_note?`<div class="field"><div class="lbl">Note dimissione</div><div class="val" style="white-space:pre-wrap">${esc(scheda.dimissione_note)}</div></div>`:''}
  ${scheda.dimissione_esito==='invio_ps'?`<div class="g3">
    ${fld('Missione AREU',scheda.invio_ps_missione_areu||'')} ${fld('Data/ora',tsStr(scheda.invio_ps_data_ora)||'')}
    ${fld('Mezzo',scheda.invio_ps_mezzo||'')} ${fld('Ospedale',scheda.invio_ps_ospedale||'')}
    ${fld('Cod. trasporto',scheda.invio_ps_codice_trasporto||'')} ${fld('Note',scheda.invio_ps_note||'')}
  </div>`:''}
  ${scheda.dimissione_esito==='riaffidato'?`<div class="g3">
    ${fld('Affidatario',`${scheda.affidatario_cognome||''} ${scheda.affidatario_nome||''}`.trim())}
    ${fld('Legame',scheda.affidatario_legame||'')}
  </div>`:''}
  ` : `<div class="box"><p class="nd">Scheda PMA non ancora inizializzata.</p></div>`}

  <h2>Valutazioni soccorso (MSA / MSB)</h2>
  ${valHtml}

  <div class="footer">
    <span>CROSS — Scheda ${esc(idVis)}</span>
    <span>Generato il ${esc(exportDate)}</span>
  </div>
</div></body></html>`;
}

// ─── Report Evento HTML ───────────────────────────────────────────────────────
function buildEventoHtml(evento, missioni, pazienti, valutazioniPerPz, exportDate) {
  const idEvento = evento.idEvento || evento._docId;
  const colore = evento.colore || evento.codiceColore || '';
  const misEvento = missioni.filter(m => m.eventoIdUnivoco === evento.idUnivoco || m.eventoCorrelato === idEvento);
  const pzEvento  = pazienti.filter(p => p.eventoIdUnivoco === evento.idUnivoco || p.eventoCorrelato === idEvento);

  const cnt = { Rosso:0,Giallo:0,Verde:0,Bianco:0,trasportati:0,arrivatoH:0 };
  pzEvento.forEach(p => {
    const c = pazienteColoreExport(p).toLowerCase();
    if (c==='rosso') cnt.Rosso++;
    else if (c==='giallo') cnt.Giallo++;
    else if (c==='verde') cnt.Verde++;
    else if (c==='bianco') cnt.Bianco++;
    if (p.esito==='Trasporta') cnt.trasportati++;
    if (p.stato==='ARRIVATO H'||p.arrivatoHAt) cnt.arrivatoH++;
  });

  const misRows = misEvento.length
    ? misEvento.map(m=>`<tr>
        <td><b>${esc(m.idMissione||'—')}</b></td><td>${esc(m.mezzo||'—')}</td>
        <td><b>${esc(m.stato||'—')}</b></td><td>${coloreBadge(m.codiceColoreMissione||'')}</td>
        <td>${esc(m.ospedaleDestinazione||'—')}</td><td>${esc(m.esitoMissione||'—')}</td>
        <td style="font-size:8.5pt">${esc(m.equipaggio||'—')}</td><td>${tsStr(m.apertura)||'—'}</td></tr>
        <tr><td colspan="8" style="font-size:8pt;color:#555;background:#fafafa;padding:2mm 3mm">
          <b>Storico stati:</b> ${esc(formatStoricoStatiInline(m.storicoStati))}
        </td></tr>`).join('')
    : `<tr><td colspan="8" class="nd" style="text-align:center;padding:4mm">Nessuna missione collegata</td></tr>`;

  const pzRows = pzEvento.length
    ? pzEvento.map(p=>{
        const s = p.pmaScheda||{};
        const pvl = Array.isArray(s.parametri_vitali)?s.parametri_vitali:[];
        const last = pvl.length ? [...pvl].sort((a,b)=>(b.registrato_at?._seconds??0)-(a.registrato_at?._seconds??0))[0] : null;
        const pvStr = last ? `GCS:${last.gcs??'?'} FC:${last.fc??'?'} SpO₂:${last.spo2_aa??'?'}` : '—';
        const nVal = (valutazioniPerPz[p._docId]||[]).length;
        const dimLabel = {dimesso:'Dimesso',invio_ps:'PS',rifiuta_invio_ps:'Rifiuto',riaffidato:'Riaffid.',deceduto:'Deceduto',si_allontana:'Allont.'}[s.dimissione_esito]||s.dimissione_esito||'—';
        const cm = p.codiceMinore || {};
        const cmLabel = p.tipoPz === 'CODICE MINORE'
          ? [cm.motivoArrivo, cm.trattamento].filter(Boolean).join(' — ') || 'CM'
          : '';
        return `<tr>
          <td><b>${esc(String(p.pettorale??'—'))}</b></td>
          <td><b>${esc([p.nome,p.cognome].filter(Boolean).join(' ')||'—')}</b> <span style="font-size:8pt;color:#666">${esc(p.tipoPz||'C')}</span></td>
          <td>${coloreBadge(pazienteColoreExport(p))}</td>
          <td>${esc(p.stato||'—')}</td><td>${esc(p.statoPzPma||cmLabel||'—')}</td>
          <td>${esc(p.esito||'—')}</td><td>${esc(p.mezzo||'—')}</td>
          <td>${esc(p.ospedaleDestinazione||'—')}</td>
          <td style="font-size:8.5pt">${esc(pvStr)}</td>
          <td style="text-align:center">${nVal||'—'}</td>
          <td><b>${esc(dimLabel)}</b></td></tr>`;
      }).join('')
    : `<tr><td colspan="11" class="nd" style="text-align:center;padding:4mm">Nessun paziente collegato</td></tr>`;

  return `<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Evento ${esc(idEvento)} — CROSS</title>
<style>${PDF_CSS}</style></head><body>
<button class="pbtn" onclick="window.print()">🖨️ Stampa / PDF</button>
<div class="page">
  <div class="hrow">
    <div>
      <h1>📋 Report Evento — ${esc(idEvento)}</h1>
      <div style="font-size:12pt;margin-top:2mm">
        ${coloreBadge(colore)} <b>${esc(evento.tipoEvento||'—')}</b>
        ${evento.dettaglioEvento?` — ${esc(evento.dettaglioEvento)}`:''}
        &nbsp;|&nbsp; 📍 <b>${esc(evento.luogo||'—')}</b>
        ${evento.luogo_fisico?` (${esc(evento.luogo_fisico)})`:''}
      </div>
    </div>
    <div class="hright">
      Stato: <b>${evento.stato===false?'CHIUSO':'APERTO'}</b><br>
      Apertura: <b>${tsStr(evento.apertura || evento.createdAt)||'—'}</b><br>
      ${evento.chiusuraIl?`Chiusura: <b>${tsStr(evento.chiusuraIl)}</b><br>`:''}
      <span style="font-size:8pt;color:#aaa">Export: ${esc(exportDate)}</span>
    </div>
  </div>

  <div class="stat-grid">
    <div class="stat-card"><div class="num">${misEvento.length}</div><div class="lbl">Missioni</div></div>
    <div class="stat-card"><div class="num">${pzEvento.length}</div><div class="lbl">Pazienti</div></div>
    <div class="stat-card r"><div class="num">${cnt.Rosso}</div><div class="lbl">🔴 Rossi</div></div>
    <div class="stat-card y"><div class="num">${cnt.Giallo}</div><div class="lbl">🟡 Gialli</div></div>
    <div class="stat-card g"><div class="num">${cnt.Verde}</div><div class="lbl">🟢 Verdi</div></div>
    <div class="stat-card"><div class="num">${cnt.Bianco}</div><div class="lbl">⚪ Bianchi</div></div>
    <div class="stat-card"><div class="num">${cnt.trasportati}</div><div class="lbl">Trasportati</div></div>
    <div class="stat-card"><div class="num">${cnt.arrivatoH}</div><div class="lbl">Arrivati H</div></div>
  </div>

  ${(evento.noteEvento || evento.descrizione)?`<div class="field"><div class="lbl">Note evento</div><div class="val" style="white-space:pre-wrap">${esc(evento.noteEvento || evento.descrizione)}</div></div>`:''}

  <h2>Missioni (${misEvento.length})</h2>
  <table><thead><tr><th>ID</th><th>Mezzo</th><th>Stato</th><th>Colore</th><th>Ospedale</th><th>Esito</th><th>Equipaggio</th><th>Apertura</th></tr></thead>
  <tbody>${misRows}</tbody></table>

  <h2>Pazienti (${pzEvento.length})</h2>
  <table><thead><tr><th>Pet.</th><th>Nome</th><th>Colore</th><th>Stato</th><th>PMA</th><th>Esito</th><th>Mezzo</th><th>Ospedale</th><th>Ultimi param.</th><th>Valut.</th><th>Dimissione</th></tr></thead>
  <tbody>${pzRows}</tbody></table>

  <div class="footer">
    <span>CROSS — Evento ${esc(idEvento)} — ${esc(evento.tipoEvento||'')} @ ${esc(evento.luogo||'')}</span>
    <span>Generato il ${esc(exportDate)}</span>
  </div>
</div></body></html>`;
}

// ─── Viewer HTML ──────────────────────────────────────────────────────────────

/**
 * Converte ricorsivamente un valore Firebase in qualcosa di sicuro per JSON embed:
 * - Timestamp  → stringa data italiana
 * - base64/firma → rimosso
 * - Array/oggetti annidati → ricorsivi
 * - Undefined/null → stringa vuota
 */
function deepClean(val, key = '') {
  if (val === null || val === undefined) return '';
  // Timestamp firebase-admin: ha _seconds e _nanoseconds
  if (typeof val === 'object' && typeof val._seconds === 'number') {
    return new Date(val._seconds * 1000).toLocaleString('it-IT');
  }
  // Timestamp con toDate()
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try { return val.toDate().toLocaleString('it-IT'); } catch { return ''; }
  }
  // Campi base64/firma: troppo grandi e inutili nel viewer
  if (typeof val === 'string') {
    const lk = key.toLowerCase();
    if (lk.includes('base64') || lk.includes('firma') || lk.includes('signature')) return '(firma)';
    if (val.length > 2000 && /^[A-Za-z0-9+/=\n\r]+$/.test(val)) return '(binario)';
    return val;
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) {
    // Array di oggetti complessi → conteggio; array di stringhe → join
    if (val.length === 0) return '';
    if (typeof val[0] === 'string') return val.join(', ');
    return `[${val.length} elementi]`;
  }
  if (typeof val === 'object') {
    // Oggetto generico → appiattisci come stringa leggibile
    const parts = Object.entries(val)
      .filter(([k]) => !k.toLowerCase().includes('base64') && !k.toLowerCase().includes('firma'))
      .map(([k, v]) => `${k}:${deepClean(v, k)}`)
      .slice(0, 8); // max 8 campi
    return parts.join(' | ');
  }
  return String(val);
}

/** Prepara un array di documenti Firestore per embedding sicuro nel viewer */
function prepareRows(rows, extraFn = null) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (['pmaScheda', 'storicoStati', 'tratteMissione', 'codiceMinore',
           'firma_paziente_base64', 'dimissione_firma_medico_base64',
           'manifestationId'].includes(k)) continue;
      out[k] = deepClean(v, k);
    }
    if (typeof extraFn === 'function') Object.assign(out, extraFn(row));
    return out;
  });
}

/** Serializza per embed sicuro: protegge </script> e caratteri speciali */
function safeJsonEmbed(obj) {
  return JSON.stringify(obj)
    .replace(/<\/script>/gi, '<\\/script>')
    .replace(/<!--/g, '<\\!--')
    .replace(/-->/g, '--\\>');
}

function buildViewer(tenantId, eventi, missioni, pazienti, valutazioni, exportDate) {

  // ── Pre-processa tutti i dati lato Node: Timestamp→stringa, base64 rimosso ──
  const PRIO = {
    eventi:     ['_report','idEvento','tipoEvento','luogo','colore','codiceColore','stato','apertura','createdAt','chiusuraIl'],
    missioni:   ['idMissione','mezzo','stato','eventoCorrelato','codiceColoreMissione','ospedaleDestinazione','apertura','esitoMissione',
      ...MISSION_STATI_ORDER.map(storicoColName)],
    pazienti:   ['_report','idPaziente','tipoPz','eventoCorrelato','pettorale','nome','cognome','codiceColoreSanitario','stato','statoPzPma',
      'codiceMinore_motivo','codiceMinore_trattamento','codiceMinore_oraArrivo','codiceMinore_oraFine','pmaScheda_presente',
      'esito','mezzo','idMissione','ospedaleDestinazione','destinazionePmaId','apertura','arrivatoHAt',
      'pma_parametri_n','pma_farmaci_n','pma_rivalutazioni_n','pma_codice_colore','pma_dimissione_esito'],
    valutazioni:['pazienteId','pettorale','nome','cognome','tipo','creatoIl','mezzo','testo','msbDetails_summary','msaDetails_summary'],
  };

  // Helper: sanitizza ID per nome file (stesso algoritmo di main())
  const sanId = id => String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');

  // Pazienti: separa pmaScheda in campi flat leggibili + link report
  const pzView = prepareRows(pazienti, row => {
    const s = row.pmaScheda || {};
    const cm = row.codiceMinore || {};
    const rid = sanId(row.idPaziente || row._docId);
    const hasScheda = s && Object.keys(s).some(k =>
      s[k] != null && s[k] !== '' && !(Array.isArray(s[k]) && s[k].length === 0));
    return {
      _report: rid ? `reports/paziente_${rid}.html` : '',
      codiceColoreSanitario: pazienteColoreExport(row),
      pmaScheda_presente: hasScheda ? 'SÌ' : '',
      codiceMinore_motivo: cm.motivoArrivo || '',
      codiceMinore_trattamento: cm.trattamento || '',
      codiceMinore_oraArrivo: tsStr(cm.oraArrivo) || '',
      codiceMinore_oraFine: tsStr(cm.oraFine) || '',
      codiceMinore_daTrasporto: cm.daTrasportoCentrale ? 'SÌ' : '',
      codiceMinore_foto_n: Array.isArray(cm.foto) ? cm.foto.length : 0,
      pma_codice_colore:  s.codice_colore  || '',
      pma_dimissione_esito: s.dimissione_esito || '',
      pma_dimesso_at:     deepClean(s.dimesso_at, 'dimesso_at'),
      pma_allergie:       s.allergie       || '',
      pma_apr:            s.apr            || '',
      pma_app:            s.app            || '',
      pma_eo_note:        s.eo_note        || '',
      pma_parametri_n:    Array.isArray(s.parametri_vitali) ? s.parametri_vitali.length : 0,
      pma_farmaci_n:      Array.isArray(s.farmaci)          ? s.farmaci.length          : 0,
      pma_rivalutazioni_n:Array.isArray(s.rivalutazioni)    ? s.rivalutazioni.length    : 0,
      pma_prestazioni:    Array.isArray(s.prestazioni_sel)  ? s.prestazioni_sel.join(', ') : '',
      pma_ultimi_par: (() => {
        const pvl = Array.isArray(s.parametri_vitali) ? s.parametri_vitali : [];
        if (!pvl.length) return '';
        const last = [...pvl].sort((a,b)=>(b.registrato_at?._seconds??0)-(a.registrato_at?._seconds??0))[0];
        return `GCS:${last.gcs??'?'} FC:${last.fc??'?'} PA:${last.pa_sistolica??'?'}/${last.pa_diastolica??'?'} SpO₂:${last.spo2_aa??'?'}`;
      })(),
    };
  });

  // Eventi: aggiunge link report
  const eventiView = prepareRows(eventi, row => {
    const rid = sanId(row.idEvento || row._docId);
    return { _report: rid ? `reports/evento_${rid}.html` : '' };
  });
  const missioniView   = prepareRows(missioni, row => expandStoricoStatiColumns(row.storicoStati));
  const valutazioniView= prepareRows(valutazioni, row => {
    const msb = row.msbDetails || {};
    const msa = row.msaDetails || {};
    return {
      msbDetails_summary: row.tipo === 'MSB'
        ? `AVPU:${msb.avpu||'?'} GCS:${msb.parametri?.gcs??'?'} col:${msb.codiceColore||''}`
        : '',
      msaDetails_summary: row.tipo === 'MSA'
        ? `GCS:${msa.parametri?.gcs??'?'} col:${msa.codiceColore||''}${msa.acc?.dataOraAcc ? ' ACC' : ''}`
        : '',
    };
  });

  const jsPRIO  = safeJsonEmbed(PRIO);
  const jsEv    = safeJsonEmbed(eventiView);
  const jsMis   = safeJsonEmbed(missioniView);
  const jsPz    = safeJsonEmbed(pzView);
  const jsVal   = safeJsonEmbed(valutazioniView);

  return `<!DOCTYPE html><html lang="it"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CROSS Export — ${esc(exportDate)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;background:#f0f2f5;color:#222}
.top{background:#1a237e;color:#fff;padding:12px 18px;display:flex;align-items:center;justify-content:space-between}
.top h1{font-size:17px;font-weight:700}.top .meta{font-size:11px;opacity:.7}
.btn{background:#fff;color:#1a237e;border:none;padding:5px 13px;border-radius:4px;cursor:pointer;font-weight:600;font-size:12px;margin-left:6px}
.tabs{display:flex;background:#283593}
.tab{padding:10px 20px;cursor:pointer;color:rgba(255,255,255,.6);font-weight:600;font-size:13px;border-bottom:3px solid transparent;user-select:none}
.tab:hover{color:#fff}.tab.active{color:#fff;border-bottom-color:#ff9800}
.bar{background:#fff;padding:8px 14px;border-bottom:1px solid #e0e0e0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.bar input{flex:1;min-width:160px;border:1px solid #ccc;border-radius:4px;padding:5px 9px;font-size:13px}
.bar input:focus{outline:none;border-color:#3949ab}
.cnt{background:#e8eaf6;color:#3949ab;border-radius:12px;padding:2px 10px;font-size:12px;font-weight:600;white-space:nowrap}
.tc{display:none;padding:12px;overflow-x:auto}.tc.active{display:block}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}
th{background:#3949ab;color:#fff;padding:8px 10px;text-align:left;font-size:12px;cursor:pointer;white-space:nowrap;user-select:none}
th:hover{background:#1a237e}
td{padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
tr:hover td{background:#f5f7ff}tr:last-child td{border-bottom:none}
.stats{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.sc{background:#fff;border-radius:6px;padding:9px 14px;box-shadow:0 1px 3px rgba(0,0,0,.08);flex:1;min-width:90px}
.sc .n{font-size:22px;font-weight:800;color:#1a237e;line-height:1}.sc .l{font-size:11px;color:#777;margin-top:1px}
.nd{text-align:center;padding:25px;color:#999;font-size:14px}
.err{background:#ffebee;color:#c62828;padding:12px 16px;border-radius:4px;margin:10px;font-size:13px}
</style></head><body>
<div class="top">
  <div><h1>🚑 CROSS — Export dati</h1>
    <div class="meta">Tenant: ${esc(tenantId)} &nbsp;|&nbsp; ${esc(exportDate)}</div>
  </div>
  <div><button class="btn" onclick="window.print()">🖨️ Stampa</button></div>
</div>
<div class="tabs">
  <div class="tab active" onclick="sw('eventi')">📋 Eventi (<span id="c-eventi">…</span>)</div>
  <div class="tab" onclick="sw('missioni')">🚑 Missioni (<span id="c-missioni">…</span>)</div>
  <div class="tab" onclick="sw('pazienti')">🏥 Pazienti (<span id="c-pazienti">…</span>)</div>
  <div class="tab" onclick="sw('valutazioni')">🔬 Valutazioni (<span id="c-valutazioni">…</span>)</div>
</div>
<div id="global-err" style="display:none"></div>
${['eventi','missioni','pazienti','valutazioni'].map((t,i)=>`
<div id="t-${t}" class="tc${i===0?' active':''}">
  <div class="bar">
    <input type="text" id="s-${t}" placeholder="🔍 Cerca in tutti i campi…" oninput="ft('${t}')">
    <span class="cnt" id="b-${t}">caricamento…</span>
  </div>
  <div class="stats" id="st-${t}"></div>
  <div style="overflow-x:auto"><table><thead id="h-${t}"></thead><tbody id="bd-${t}"><tr><td class="nd">Caricamento…</td></tr></tbody></table></div>
</div>`).join('')}
<script>
(function(){
try {
  var D = {
    eventi:      ${jsEv},
    missioni:    ${jsMis},
    pazienti:    ${jsPz},
    valutazioni: ${jsVal}
  };
  var P = ${jsPRIO};
  // Colonne da NON mostrare nel viewer
  var HID = new Set(['_docId','idUnivoco','eventoIdUnivoco','missioneIdUnivoco','manifestationId',
    'storicoStati','tratteMissione','idPazienteRef','pmaSchedaInizializzata',
    'aperta','noteDiario','telegramChatId']);
  var ST = {sc:{}, sd:{}};
  var CBG = {
    bianco:'background:#e8e8e8;color:#333', Bianco:'background:#e8e8e8;color:#333',
    verde:'background:#4caf50;color:#fff',  Verde:'background:#4caf50;color:#fff',
    giallo:'background:#f9a825;color:#333', Giallo:'background:#f9a825;color:#333',
    rosso:'background:#d32f2f;color:#fff',  Rosso:'background:#d32f2f;color:#fff',
    nero:'background:#212121;color:#fff',   Nero:'background:#212121;color:#fff'
  };

  function fs(v) {
    if (v == null || v === '') return '';
    if (typeof v === 'boolean') return v ? 'Sì' : 'No';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'object') return JSON.stringify(v).slice(0,80);
    return String(v);
  }

  function badge(v) {
    var s = CBG[v];
    if (!s) return v || '';
    return '<span style="display:inline-block;padding:1px 9px;border-radius:9px;' + s + ';font-weight:700;font-size:11px;border:1px solid rgba(0,0,0,.15)">' + v + '</span>';
  }

  function cell(col, val) {
    // Link report PDF
    if (col === '_report') {
      if (!val) return '<span style="color:#ccc">—</span>';
      return '<a href="' + val + '" target="_blank" style="display:inline-block;background:#1a237e;color:#fff;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;text-decoration:none;white-space:nowrap">📄 Apri&nbsp;PDF</a>';
    }
    var COLORE_COLS = ['colore','codiceColore','codiceColoreSanitario','codiceColoreMissione','pma_codice_colore','coloreEvento'];
    if (COLORE_COLS.indexOf(col) !== -1) return badge(val);
    var s = fs(val);
    if (!s) return '<span style="color:#ccc">—</span>';
    var escaped = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    if (escaped.length > 70) return '<span title="' + escaped + '">' + escaped.slice(0,70) + '…</span>';
    return escaped;
  }

  function getCols(tab) {
    var rows = D[tab];
    if (!rows || !rows.length) return [];
    var all = [];
    var seen = {};
    rows.forEach(function(r) { Object.keys(r).forEach(function(k){ if(!seen[k]){ seen[k]=1; all.push(k); } }); });
    all = all.filter(function(c){ return !HID.has(c); });
    var prio = (P[tab] || []).filter(function(c){ return seen[c]; });
    var rest = all.filter(function(c){ return prio.indexOf(c) === -1; });
    return prio.concat(rest);
  }

  function renderTable(tab) {
    var rows = D[tab] || [];
    var cols = getCols(tab);
    var hdr = document.getElementById('h-'+tab);
    var body = document.getElementById('bd-'+tab);
    var badge_el = document.getElementById('b-'+tab);
    var cnt_el = document.getElementById('c-'+tab);

    if (!cols.length) {
      body.innerHTML = '<tr><td class="nd">Nessun dato disponibile (0 record)</td></tr>';
      if (cnt_el) cnt_el.textContent = '0';
      if (badge_el) badge_el.textContent = '0 righe';
      return;
    }

    // Header con sort
    hdr.innerHTML = '<tr>' + cols.map(function(c){
      var icon = ST.sc[tab]===c ? (ST.sd[tab]===1?'▲':'▼') : '↕';
      var label = c === '_report' ? '📄 PDF' : c;
      var sortable = c === '_report' ? '' : ' onclick="sortBy(&quot;'+tab+'&quot;,&quot;'+c+'&quot;)"';
      return '<th'+sortable+' title="'+c+'" style="'+( c === '_report' ? 'min-width:80px;cursor:default' : '')+'">' + label + (c === '_report' ? '' : ' <span style="opacity:.5;font-size:9px">'+icon+'</span>') + '</th>';
    }).join('') + '</tr>';

    // Filtro ricerca
    var q = (document.getElementById('s-'+tab)||{value:''}).value.toLowerCase();
    var vis = rows.filter(function(r){
      if (!q) return true;
      return cols.some(function(c){ return fs(r[c]).toLowerCase().indexOf(q) !== -1; });
    });

    // Ordinamento
    var sc = ST.sc[tab];
    if (sc) {
      var d = ST.sd[tab] || 1;
      vis = vis.slice().sort(function(a,b){
        var av = fs(a[sc]), bv = fs(b[sc]);
        return av < bv ? -d : av > bv ? d : 0;
      });
    }

    if (!vis.length) {
      body.innerHTML = '<tr><td colspan="'+cols.length+'" class="nd">Nessun risultato per "'+q+'"</td></tr>';
    } else {
      body.innerHTML = vis.map(function(r){
        return '<tr>'+cols.map(function(c){ return '<td>'+cell(c,r[c])+'</td>'; }).join('')+'</tr>';
      }).join('');
    }

    if (badge_el) badge_el.textContent = vis.length + ' / ' + rows.length + ' righe';
    if (cnt_el)   cnt_el.textContent = rows.length;
  }

  function renderStats(tab) {
    var rows = D[tab] || [];
    var el = document.getElementById('st-'+tab);
    if (!el) return;
    var cards = [];
    if (tab === 'pazienti') {
      var bc = {};
      rows.forEach(function(p){ var c = p.codiceColoreSanitario||p.pma_codice_colore||'N/D'; bc[c]=(bc[c]||0)+1; });
      cards.push({n:rows.length,l:'Totale'});
      cards.push({n:rows.filter(function(p){return p.esito==='Trasporta';}).length,l:'Trasportati'});
      ['Rosso','Giallo','Verde','Bianco'].forEach(function(c){ if(bc[c]) cards.push({n:bc[c],l:'Cod.'+c}); });
    } else if (tab === 'missioni') {
      var bs = {};
      rows.forEach(function(m){ bs[m.stato]=(bs[m.stato]||0)+1; });
      cards.push({n:rows.length,l:'Totale'});
      Object.keys(bs).sort(function(a,b){return bs[b]-bs[a];}).slice(0,5).forEach(function(s){ cards.push({n:bs[s],l:s}); });
    } else if (tab === 'eventi') {
      cards.push({n:rows.length,l:'Totale'});
      cards.push({n:rows.filter(function(e){return e.stato!==false&&e.stato!=='false';}).length,l:'Aperti'});
      cards.push({n:rows.filter(function(e){return e.stato===false||e.stato==='false';}).length,l:'Chiusi'});
    } else if (tab === 'valutazioni') {
      var bt = {};
      rows.forEach(function(v){ bt[v.tipo]=(bt[v.tipo]||0)+1; });
      cards.push({n:rows.length,l:'Totale'});
      Object.keys(bt).forEach(function(t){ cards.push({n:bt[t],l:t}); });
    }
    el.innerHTML = cards.map(function(c){
      return '<div class="sc"><div class="n">'+c.n+'</div><div class="l">'+c.l+'</div></div>';
    }).join('');
  }

  window.sortBy = function(tab, col) {
    if (ST.sc[tab]===col) ST.sd[tab]=(ST.sd[tab]||1)*-1;
    else { ST.sc[tab]=col; ST.sd[tab]=1; }
    renderTable(tab);
  };
  window.ft = function(tab) { renderTable(tab); };
  window.sw = function(tab) {
    var tabs = ['eventi','missioni','pazienti','valutazioni'];
    document.querySelectorAll('.tab').forEach(function(t,i){ t.classList.toggle('active', tabs[i]===tab); });
    document.querySelectorAll('.tc').forEach(function(c){ c.classList.remove('active'); });
    var el = document.getElementById('t-'+tab);
    if (el) el.classList.add('active');
  };

  // Init
  ['eventi','missioni','pazienti','valutazioni'].forEach(function(t){ renderStats(t); renderTable(t); });

} catch(e) {
  var errEl = document.getElementById('global-err');
  if (errEl) {
    errEl.style.display = 'block';
    errEl.innerHTML = '<div class="err">⚠️ Errore JavaScript nel viewer: <b>' + e.message + '</b><br><small>' + e.stack + '</small></div>';
  }
  console.error('Viewer error:', e);
}
})();
</script></body></html>`;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🔥  CROSS Firebase Export\n');

  const tenantId = await selectTenant();
  console.log('\n⏳  Download dati Firebase…');

  const [eventi, missioni, pazienti, mezzi] = await Promise.all([
    fetchAll(tenantId, 'eventi'),
    fetchAll(tenantId, 'missioni'),
    fetchAll(tenantId, 'pazienti'),
    fetchAll(tenantId, 'mezzi'),
  ]);
  console.log(`   📋  ${eventi.length} eventi`);
  console.log(`   🚑  ${missioni.length} missioni`);
  console.log(`   🚐  ${mezzi.length} mezzi`);
  console.log(`   🏥  ${pazienti.length} pazienti`);

  const valutazioni = await fetchValutazioni(tenantId, pazienti);
  console.log(`   🔬  ${valutazioni.length} valutazioni MSA/MSB`);

  const valPerPz = {};
  valutazioni.forEach(v => { (valPerPz[v.pazienteDocId] ??= []).push(v); });

  // Cartella output
  const now = new Date();
  const ts  = now.toISOString().replace(/[:.]/g,'-').slice(0,19);
  const customDir = process.argv.slice(2).join(' ').trim();
  const folderName = customDir || ts;
  const outDir = join(ROOT, 'Dati esportati_local', folderName);
  const repDir = join(outDir, 'reports');
  const jsonDir = join(outDir, 'json');
  mkdirSync(repDir, { recursive: true });
  mkdirSync(jsonDir, { recursive: true });
  const exportDate = now.toLocaleString('it-IT');

  // CSV completo (tutti i campi Firestore + JSON nested + storico stati espanso)
  console.log('\n📄  CSV (export completo)…');
  const STORICO_COLS = MISSION_STATI_ORDER.map(storicoColName);
  const COLS_EV  = ['_docId','idEvento','chiamante','tipoEvento','dettaglioEvento','tipoLuogo','luogo','luogo_fisico','indirizzo','meteo','colore','noteEvento','stato','apertura','operativoTerminato','chiusuraIl','noteChiusura','tipoChiusuraEvento'];
  const COLS_MIS = ['_docId','idMissione','eventoCorrelato','mezzo','stato','aperta','codiceColoreMissione','esitoMissione','ospedaleDestinazione','tipoTrasporto','equipaggio','noteMissione','apertura','statoDa', ...STORICO_COLS, 'storicoStati_json','tratteMissione_json','pazienteRiferimento_json'];
  const COLS_MEZ = ['_docId','sigla','tipo','targa','radio','statoMezzo','operativo','noteOperativo','stazionamento_json','stazione_indirizzo','stazione_luogo_fisico','posizioneReale_json','posizioneReale_lat','posizioneReale_lng','creatoIl'];
  const COLS_VAL = ['pazienteDocId','pazienteId','pettorale','nome','cognome','tipo','creatoIl','mezzo','testo','msbDetails_json','msaDetails_json'];
  const COLS_PZ  = ['_docId','idPaziente','idUnivoco','tipoPz','eventoCorrelato','eventoIdUnivoco','pettorale','nome','cognome','eta','sesso','dataNascita','codiceColoreSanitario','codiceColoreSanitario_export','stato','statoPzPma','esito','esitoAltro','mezzo','idMissione','missioneIdUnivoco','ospedaleDestinazione','destinazionePmaId','pmaId','apertura','arrivatoHAt','aperta','notePaziente','pmaScheda_json','codiceMinore_json'];

  const eventiCsv = eventi.map(docToFullCsvRow);
  const missioniCsv = missioni.map(docToFullCsvRow);
  const mezziCsv = mezzi.map(flattenMezzoFullCsv);
  const pzCsv = pazienti.map(flattenPazienteFullCsv);
  const valutazioniCsv = valutazioni.map(docToFullCsvRow);

  writeFileSync(join(outDir,'eventi.csv'),    toCsvOrdered(eventiCsv,    COLS_EV),  'utf8');
  writeFileSync(join(outDir,'missioni.csv'),  toCsvOrdered(missioniCsv,  COLS_MIS), 'utf8');
  writeFileSync(join(outDir,'mezzi.csv'),     toCsvOrdered(mezziCsv,  COLS_MEZ), 'utf8');
  writeFileSync(join(outDir,'pazienti.csv'),  toCsvOrdered(pzCsv,     COLS_PZ),  'utf8');
  writeFileSync(join(outDir,'valutazioni.csv'),toCsvOrdered(valutazioniCsv,COLS_VAL),'utf8');
  console.log('   ✅  5 CSV generati (campi completi)');

  // JSON dump integrale
  console.log('📦  json/…');
  const ser = (arr) => JSON.stringify(arr.map(d => serializeForExportNode(d)), null, 2);
  writeFileSync(join(jsonDir, 'eventi.json'), ser(eventi), 'utf8');
  writeFileSync(join(jsonDir, 'missioni.json'), ser(missioni), 'utf8');
  writeFileSync(join(jsonDir, 'mezzi.json'), ser(mezzi), 'utf8');
  writeFileSync(join(jsonDir, 'pazienti.json'), ser(pazienti), 'utf8');
  writeFileSync(join(jsonDir, 'valutazioni.json'), ser(valutazioni), 'utf8');
  console.log('   ✅  5 JSON dump Firestore');

  // Viewer
  console.log('🌐  viewer.html…');
  writeFileSync(join(outDir,'viewer.html'), buildViewer(tenantId,eventi,missioni,pazienti,valutazioni,exportDate), 'utf8');
  console.log('   ✅  viewer.html');

  // Report eventi
  console.log(`📋  Report ${eventi.length} eventi…`);
  for (const ev of eventi) {
    const id = String(ev.idEvento||ev._docId).replace(/[^a-zA-Z0-9_-]/g,'_');
    writeFileSync(join(repDir,`evento_${id}.html`), buildEventoHtml(ev,missioni,pazienti,valPerPz,exportDate), 'utf8');
  }
  console.log(`   ✅  ${eventi.length} report evento`);

  // Schede pazienti
  console.log(`🏥  Schede ${pazienti.length} pazienti…`);
  for (const pz of pazienti) {
    const id = String(pz.idPaziente||pz._docId).replace(/[^a-zA-Z0-9_-]/g,'_');
    writeFileSync(join(repDir,`paziente_${id}.html`), buildPazienteHtml(pz,valPerPz[pz._docId]||[],exportDate), 'utf8');
  }
  console.log(`   ✅  ${pazienti.length} schede paziente`);

  console.log(`
╔══════════════════════════════════════════════╗
║  ✅  Export completato!                      ║
║                                              ║
║  📁  Dati esportati_local/${folderName}/
║      eventi.csv  missioni.csv  mezzi.csv      ║
║      pazienti.csv  valutazioni.csv           ║
║      json/ (dump Firestore completo)         ║
║      viewer.html                             ║
║      reports/ (${String(eventi.length+pazienti.length).padEnd(3)} file HTML)               ║
╚══════════════════════════════════════════════╝

  Per PDF: apri un file reports/ in Chrome
           poi Ctrl+P → Salva come PDF
`);
  process.exit(0);
}

main().catch(err => {
  console.error('\n❌  Errore:', err.message);
  console.error(err.stack);
  process.exit(1);
});
