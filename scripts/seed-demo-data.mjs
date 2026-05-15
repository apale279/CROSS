/**
 * Seed entità di prova su Firestore (mezzi DEMO-###, eventi aperti, missioni, pazienti).
 * Vincolo operativo: al massimo 3 pazienti in «Trasporta» sullo STESSO mezzo (capacità mezzo/logistica).
 *
 * npm run seed:demo
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  limit,
  setDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

/** Massimo trasportati concorrenti per singola risorsa (mezzo missione). */
const MAX_PAZIENTI_TRASPORTO_PER_MEZZO = 3;

const ESITO_TRASPORTA = 'Trasporta';
const ESITO_ALTRO = 'Altro (specificare)';

function loadDotEnv() {
  const pathsToTry = [join(ROOT, '.env'), join(ROOT, '.env.local')];
  for (const p of pathsToTry) {
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i === -1) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
    break;
  }
}

loadDotEnv();

function paths(tenant) {
  const base = ['manifestazioni', tenant];
  return {
    eventi: [...base, 'eventi'],
    missioni: [...base, 'missioni'],
    mezzi: [...base, 'mezzi'],
    pazienti: [...base, 'pazienti'],
  };
}

function newIdUnivoco() {
  return crypto.randomUUID();
}

function nextProgressiveId(prefix, items, fieldName) {
  let max = 0;
  for (const item of items) {
    const raw = item[fieldName] ?? item._docId ?? '';
    const match = String(raw).match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}${max + 1}`;
}

const emptyEquipaggio = () => ({
  autista: { nome: '', cognome: '', telefono: '' },
  medico: { nome: '', cognome: '', telefono: '' },
  soccorritore1: { nome: '', cognome: '', telefono: '' },
  soccorritore2: { nome: '', cognome: '', telefono: '' },
});

const TIPI_MEZZO_SEED = ['Ambulanza', 'Auto medica', 'Moto medica'];

/**
 * Eventi di prova: numeri piccoli, pazienti tutti distinti, 1–3 mezzi.
 * Totale pazienti: 2+4+3+5+6 = 20 (nessun eccesso).
 */
const EVENT_PLAN = [
  { nome: 'Gara podistica (prova)', tipo: 'Malore', pazienti: 2, numMezzi: 1 },
  { nome: 'Concerto (prova)', tipo: 'Trauma', pazienti: 4, numMezzi: 2 },
  { nome: 'Fiera (prova)', tipo: 'Intossicazione', pazienti: 3, numMezzi: 2 },
  { nome: 'Ciclismo (prova)', tipo: 'Malore', pazienti: 5, numMezzi: 1 },
  { nome: 'Mercatino (prova)', tipo: 'Altro', pazienti: 6, numMezzi: 3 },
];

/**
 * Decide esito per paziente: `transport` usa missione dopo cap check;
 * sempre rispetto MAX_PAZIENTI_TRASPORTO_PER_MEZZO sulla missione di riferimento.
 */
function pianificaEsitiPazienti(numPazienti, missioni) {
  /** @typedef {{ tipo: 'transport', mis: typeof missioni[0] } | { tipo: 'altro', esito: string }} Slot */
  /** @type {Slot[]} */
  const slots = [];
  /** @type {Record<string, number>} */
  const caricoSuMezzo = {};
  for (const m of missioni) caricoSuMezzo[m.sigla] = 0;

  const capacitaGlobale = missioni.length * MAX_PAZIENTI_TRASPORTO_PER_MEZZO;
  /** Trasportati realistici: non riempiamo sempre tutto; almeno 1 non-trasport se ≥2 pazienti */
  let targetTrasporto = Math.min(numPazienti, capacitaGlobale, Math.max(1, Math.ceil(numPazienti * 0.55)));
  if (numPazienti >= 2 && targetTrasporto >= numPazienti) targetTrasporto = numPazienti - 1;

  const altriEsitiCycle = ['Non trasporta', 'Risolto in posto', ESITO_ALTRO, 'Si allontana'];

  function scegliMissioneLibera() {
    let best = null;
    let bestLoad = Infinity;
    for (const m of missioni) {
      const n = caricoSuMezzo[m.sigla];
      if (n >= MAX_PAZIENTI_TRASPORTO_PER_MEZZO) continue;
      if (n < bestLoad) {
        bestLoad = n;
        best = m;
      }
    }
    return best;
  }

  let daTrasportare = Math.min(targetTrasporto, capacitaGlobale);
  let altroIx = 0;
  for (let i = 0; i < numPazienti; i += 1) {
    const misLibera = scegliMissioneLibera();
    if (daTrasportare > 0 && misLibera) {
      slots.push({ tipo: 'transport', mis: misLibera });
      caricoSuMezzo[misLibera.sigla] += 1;
      daTrasportare -= 1;
    } else {
      slots.push({ tipo: 'altro', esito: altriEsitiCycle[altroIx % altriEsitiCycle.length] });
      altroIx += 1;
    }
  }
  return { slots, caricoSuMezzo };
}

async function resolveTenant(db) {
  const envTenant = (process.env.VITE_TENANT_ID ?? '').trim();
  if (envTenant) return envTenant;

  const manRef = collection(db, 'manifestazioni');
  const snap = await getDocs(query(manRef, limit(2)));
  if (snap.empty) {
    throw new Error('Collezione manifestazioni vuota. Crea il tenant o imposta VITE_TENANT_ID.');
  }
  if (snap.size > 1) {
    throw new Error(
      'Più manifestazioni trovate. Imposta VITE_TENANT_ID nel .env e rilancia lo script.',
    );
  }
  return snap.docs[0].id;
}

function fmtEquipaggioString(equipaggio) {
  const roles = [
    ['Autista', equipaggio?.autista],
    ['Medico/CE', equipaggio?.medico],
    ['Soccorritore 1', equipaggio?.soccorritore1],
    ['Soccorritore 2', equipaggio?.soccorritore2],
  ];
  return roles
    .map(([label, p]) => {
      if (!p?.nome && !p?.cognome) return null;
      const nome = [p.nome, p.cognome].filter(Boolean).join(' ');
      const tel = p.telefono ? ` — ${p.telefono}` : '';
      return `${label}: ${nome}${tel}`;
    })
    .filter(Boolean)
    .join(' | ');
}

async function main() {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    console.error(
      'Manca .env con VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID (e opzionale VITE_TENANT_ID).',
    );
    process.exit(1);
  }

  const app = initializeApp({
    apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);

  const tenant = await resolveTenant(db);
  const p = paths(tenant);
  console.log(`Tenant: ${tenant} | cap trasportati/mezzo: ≤${MAX_PAZIENTI_TRASPORTO_PER_MEZZO}`);

  const [evSnap, misSnap, mezSnap, pazSnap] = await Promise.all([
    getDocs(collection(db, ...p.eventi)),
    getDocs(collection(db, ...p.missioni)),
    getDocs(collection(db, ...p.mezzi)),
    getDocs(collection(db, ...p.pazienti)),
  ]);

  let rowsEventi = evSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  let rowsMissioni = misSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  /** @type {{ sigla: string }[]} */
  const rowsMezzi = mezSnap.docs.map((d) => ({ sigla: d.id, ...d.data() }));
  let rowsPazienti = pazSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));

  let demoMezzoSeq =
    rowsMezzi.reduce((max, row) => {
      const sid = typeof row.sigla === 'string' ? row.sigla : '';
      const m = /^DEMO-(\d+)$/i.exec(sid);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0) || rowsMezzi.length;

  const COLORI_ROT = ['Bianco', 'Verde', 'Giallo', 'Rosso', 'Giallo'];
  const eventiCreati = [];

  for (let ei = 0; ei < EVENT_PLAN.length; ei += 1) {
    const plan = EVENT_PLAN[ei];
    const sigle = [];
    for (let m = 0; m < plan.numMezzi; m += 1) {
      demoMezzoSeq += 1;
      const sigla = `DEMO-${String(demoMezzoSeq).padStart(3, '0')}`;
      sigle.push(sigla);
      const tipo = TIPI_MEZZO_SEED[(demoMezzoSeq + ei) % TIPI_MEZZO_SEED.length];
      await setDoc(doc(db, ...p.mezzi, sigla), {
        manifestationId: tenant,
        idUnivoco: newIdUnivoco(),
        sigla,
        tipo,
        stazionamento: {
          indirizzo: `[Prova seed] ${plan.nome}`,
          coordinate: null,
        },
        stazionamentoPredefinito: false,
        targa: `SE${demoMezzoSeq % 990}XR`,
        radio: sigla.replace('DEMO-', ''),
        statoMezzo: 'Disponibile',
        equipaggio: emptyEquipaggio(),
        operativo: true,
        noteOperativo: '',
        noteProvaSeed: true,
        creatoIl: serverTimestamp(),
      });
      rowsMezzi.push({ sigla });
      console.log(`  + Mezzo ${sigla} (${tipo})`);
    }

    const idEvento = nextProgressiveId('E', rowsEventi, 'idEvento');
    const idUnivocoEvento = newIdUnivoco();
    const payloadEvento = {
      manifestationId: tenant,
      idUnivoco: idUnivocoEvento,
      idEvento,
      apertura: serverTimestamp(),
      stato: true,
      indirizzo: `[Seed] Piazza test ${ei + 1}`,
      tipoEvento: plan.tipo,
      dettaglioEvento: `Entità di prova • ${plan.nome}`,
      colore: COLORI_ROT[ei % COLORI_ROT.length],
      noteEvento: 'Creato da seed:demo',
    };

    const evRef = await addDoc(collection(db, ...p.eventi), payloadEvento);
    rowsEventi.push({ _docId: evRef.id, ...payloadEvento });
    console.log(`Evento ${idEvento} — ${plan.nome}`);

    /** @type {{ idMissione: string, idUnivoco: string, sigla: string }[]} */
    const missioniEvento = [];
    for (const sigla of sigle) {
      const idMissione = nextProgressiveId('M', rowsMissioni, 'idMissione');
      const idUnivocoMis = newIdUnivoco();
      const statoIniziale = 'ALLERTARE';
      const mezzoDoc = rowsMezzi.find((x) => x.sigla === sigla);

      const misRef = await addDoc(collection(db, ...p.missioni), {
        manifestationId: tenant,
        idUnivoco: idUnivocoMis,
        idMissione,
        eventoIdUnivoco: idUnivocoEvento,
        eventoCorrelato: idEvento,
        mezzo: sigla,
        stato: statoIniziale,
        statoDa: serverTimestamp(),
        storicoStati: { [statoIniziale]: serverTimestamp() },
        pazienteAutopresentato: false,
        equipaggio: fmtEquipaggioString(mezzoDoc?.equipaggio),
        aperta: true,
        apertura: serverTimestamp(),
        noteProvaSeed: true,
      });
      rowsMissioni.push({ _docId: misRef.id, idMissione, idUnivoco: idUnivocoMis });
      await setDoc(
        doc(db, ...p.mezzi, sigla),
        { manifestationId: tenant, statoMezzo: 'Non disponibile' },
        { merge: true },
      );
      missioniEvento.push({ idMissione, idUnivoco: idUnivocoMis, sigla });
      console.log(`    Missione ${idMissione} → ${sigla}`);
    }

    const { slots, caricoSuMezzo } = pianificaEsitiPazienti(plan.pazienti, missioniEvento);
    console.log(
      `    Carico trasportati/mezzo (max ${MAX_PAZIENTI_TRASPORTO_PER_MEZZO}): ${JSON.stringify(caricoSuMezzo)}`,
    );

    for (let pi = 0; pi < plan.pazienti; pi += 1) {
      const slot = slots[pi];
      const idPaziente = nextProgressiveId('P', rowsPazienti, 'idPaziente');
      const idUnivocoP = newIdUnivoco();

      let esito;
      let trasporta = false;
      /** @type {typeof missioniEvento[0] | null} */
      let mis = null;

      if (slot.tipo === 'transport') {
        esito = ESITO_TRASPORTA;
        trasporta = true;
        mis = slot.mis;
      } else {
        esito = slot.esito;
      }

      const pazPayload = {
        manifestationId: tenant,
        idUnivoco: idUnivocoP,
        idPaziente,
        eventoIdUnivoco: idUnivocoEvento,
        eventoCorrelato: idEvento,
        aperta: true,
        apertura: Timestamp.fromDate(new Date()),
        esito,
        esitoAltro: esito === ESITO_ALTRO ? 'Valutazione seed' : '',
        ospedaleDestinazione: trasporta ? 'Ospedale seed (prova)' : '',
        stato: trasporta ? 'TRASPORTO' : 'ATTESA',
        mezzo: trasporta && mis ? mis.sigla : '',
        idMissione: trasporta && mis ? mis.idMissione : '',
        missioneIdUnivoco: trasporta && mis ? mis.idUnivoco : '',
        arrivatoHAt: null,
        pettorale: 200 + ei * 20 + pi,
        telefono: `3${ei}${String(pi).padStart(2, '0')}0000000`.slice(0, 10),
        dataNascita: '1990-05-20',
        nome: `Prova`,
        cognome: `E${ei + 1}_${pi + 1}`,
        eta: 25 + ((pi + ei * 3) % 40),
        sesso: pi % 2 === 0 ? 'M' : 'F',
        notePaziente: `Seed • ${plan.nome}`,
        noteProvaSeed: true,
      };

      await addDoc(collection(db, ...p.pazienti), pazPayload);
      rowsPazienti.push({ idPaziente });
      console.log(`    Paziente ${idPaziente} — ${esito}${mis ? ` (${mis.sigla})` : ''}`);
    }

    eventiCreati.push({
      idEvento,
      pazienti: plan.pazienti,
      mezzi: sigle.length,
      caricoTrasporto: { ...caricoSuMezzo },
    });
  }

  console.log('\n--- Riepilogo seed ---');
  for (const x of eventiCreati) {
    console.log(
      `  ${x.idEvento}: ${x.pazienti} pazienti, ${x.mezzi} mezzo/i, trasportati/mezzo ${JSON.stringify(x.caricoTrasporto)}`,
    );
  }
  console.log('OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
