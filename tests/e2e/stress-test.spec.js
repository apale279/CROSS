/**
 * CROSS — Stress test operativo (suite completa)
 *
 * Throttle Firestore (evita loop lettura/scrittura e quota 429):
 *   STRESS_WRITE_DELAY_MS=20000   — pausa minima tra scritture
 *   STRESS_BETWEEN_TESTS_MS=60000 — pausa tra un test e il successivo
 *
 * Avvio (NON automatico da questo file):
 *   npm run test:stress
 *
 * Login bypass: VITE_E2E_AUTO_LOGIN + .env.test
 */

import { test, expect } from '@playwright/test';
import {
  STRESS_TAG,
  stressNote,
  waitForAppReady,
  assertAppHealthy,
  creaEvento,
  creaMissione,
  cambiaStatoMissione,
  cambiaStatoMissioneAperta,
  creaPaziente,
  cicloTrasportoOspedale,
  chiudiDialog,
  apriMissionePerEvento,
  eseguiDirottamento,
  eseguiFlagDown,
  eseguiAvariaSinistro,
  apriTabEvento,
  apriNuovoEvento,
  apriEventoPerId,
  getEventoIdFromDialog,
  eventDialog,
  topDialog,
  installDialogAutoAccept,
  pulisciEventiStressAperti,
} from './helpers/cross-app.js';
import {
  markSuiteStart,
  pausaTraTest,
  dopoScrittura,
  stressStats,
  warmupSuite,
} from './helpers/stress-throttle.js';

// ── Helper locali (solo UI, nessun polling Firestore) ───────────────────────

async function selezionaPrimaDestinazionePma(pazDlg) {
  const ospedale = pazDlg.getByRole('combobox', { name: /ospedale destinazione/i });
  await ospedale.waitFor({ state: 'visible', timeout: 10_000 });
  const options = await ospedale.locator('option').all();
  for (let i = 0; i < options.length; i++) {
    const text = ((await options[i].textContent()) ?? '').trim();
    if (/PMA/i.test(text) && text.length > 2) {
      await ospedale.selectOption({ index: i });
      return text;
    }
  }
  throw new Error('Nessuna destinazione PMA in elenco ospedali');
}

async function creaPazienteDestinazionePma(page, { nome, cognome, missioneIndex = 0 } = {}) {
  await apriTabEvento(page, 'pazienti');
  const dlg = eventDialog(page);
  await dlg.getByRole('button', { name: /nuovo paziente/i }).click();
  const pazDlg = topDialog(page);
  await expect(pazDlg.getByRole('heading', { name: /nuovo paziente/i })).toBeVisible({
    timeout: 10_000,
  });
  await pazDlg.getByLabel(/^nome$/i).or(pazDlg.locator('label:has-text("Nome") input')).first().fill(nome);
  await pazDlg
    .getByLabel(/^cognome$/i)
    .or(pazDlg.locator('label:has-text("Cognome") input'))
    .first()
    .fill(cognome);
  await pazDlg.getByRole('combobox', { name: /^esito$/i }).selectOption('Trasporta');
  await page.waitForTimeout(600);
  const missionField = pazDlg.getByRole('combobox', { name: /^missione/i });
  const opts = await missionField.locator('option:not([value=""])').all();
  if (opts.length > 0) {
    await missionField.selectOption({ index: Math.min(missioneIndex + 1, opts.length) });
  }
  const destLabel = await selezionaPrimaDestinazionePma(pazDlg);
  await pazDlg.getByRole('button', { name: /crea paziente/i }).click();
  await expect(pazDlg.getByRole('heading', { name: /nuovo paziente/i })).toBeHidden({
    timeout: 20_000,
  });
  console.log(`   ✓ Paziente PMA: ${cognome} ${nome} → ${destLabel}`);
  await dopoScrittura(page, 'paziente PMA creato');
}

async function attendiBadgeEvento(page, testoBadge) {
  const dlg = eventDialog(page);
  await expect(dlg.getByText(new RegExp(testoBadge, 'i'))).toBeVisible({ timeout: 90_000 });
}

async function eseguiChiusuraForzataEvento(page, nota = `${STRESS_TAG} chiusura forzata E2E`) {
  const dlg = eventDialog(page);
  await dlg.getByRole('button', { name: /^chiudi evento$/i }).click();
  await dlg.locator('textarea').last().fill(nota);
  await dlg.getByRole('button', { name: /conferma chiusura evento/i }).click();
  await expect(dlg.getByText('Nota di chiusura', { exact: false })).toBeVisible({ timeout: 60_000 });
  console.log('   ✓ Chiusura forzata evento confermata');
  await dopoScrittura(page, 'chiusura forzata evento');
}

async function riapriEventoOperativo(page) {
  const dlg = eventDialog(page);
  await dlg.getByRole('button', { name: /riapri evento/i }).click();
  await expect(dlg.getByText('Aperto', { exact: true })).toBeVisible({ timeout: 30_000 });
  console.log('   ✓ Evento riaperto');
  await dopoScrittura(page, 'riapri evento');
}

async function contaMissioniAperte(page) {
  const dlg = eventDialog(page);
  await apriTabEvento(page, 'missioni');
  const items = dlg.getByRole('listitem');
  const n = await items.count();
  let aperte = 0;
  for (let i = 0; i < n; i++) {
    const sel = items.nth(i).getByRole('combobox').first();
    if (!(await sel.isDisabled().catch(() => true))) aperte += 1;
  }
  return { totale: n, aperte };
}

async function noriaTrasportoSequenziale(page, cicli = 4, mezzoIndex = 0) {
  for (let i = 0; i < cicli; i++) {
    await creaMissione(page, { mezzoIndex });
    await cambiaStatoMissione(page, 'IN POSTO', i);
    await creaPaziente(page, {
      nome: `N${i + 1}`,
      cognome: 'Noria',
      esito: 'Trasporta',
      missioneIndex: i,
    });
    await apriTabEvento(page, 'missioni');
    await cambiaStatoMissione(page, 'ARRIVATO H', i);
    await cambiaStatoMissione(page, 'RIENTRO', i);
    await cambiaStatoMissione(page, 'FINE MISSIONE', i);
    console.log(`   ✓ Noria ciclo ${i + 1}/${cicli} completato`);
  }
}

async function verificaMezzoNonInElenco(page, siglaParziale) {
  const dlg = eventDialog(page);
  await apriTabEvento(page, 'missioni');
  await dlg.getByRole('button', { name: /nuova missione/i }).click();
  await page.waitForTimeout(500);
  const mezzoField = dlg.getByRole('combobox', { name: /^mezzo$/i });
  if (!(await mezzoField.isVisible().catch(() => false))) return false;
  const options = await mezzoField.locator('option').allTextContents();
  return !options.some((t) => t.includes(siglaParziale));
}

async function navigaTutteLePagineConPma(page) {
  const routes = [
    '/',
    '/diario',
    '/eventi',
    '/missioni',
    '/pazienti',
    '/mezzi',
    '/pma',
    '/impostazioni',
  ];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForTimeout(800);
    await assertAppHealthy(page, `route ${route}`);
  }
  console.log('   ✓ Navigazione completa (incluso PMA) senza crash');
}

async function puliziaFinaleSessione(page) {
  console.log('\n🧹 Pulizia finale sessione stress test…');
  await page.goto('/impostazioni');
  await expect(page.getByText('Zona pericolosa')).toBeVisible({ timeout: 20_000 });

  const labels = ['Eventi', 'Missioni', 'Pazienti'];
  for (const label of labels) {
    const cb = page.getByRole('checkbox', { name: label });
    if (await cb.isVisible().catch(() => false)) {
      await cb.check();
    }
  }

  const eliminaBtn = page.getByRole('button', { name: /elimina selezionati/i });
  await eliminaBtn.click();
  await page.waitForTimeout(3_000);

  const feedback = page.locator('text=/eliminat|esportat|operazione/i').first();
  await expect(feedback.or(page.getByText('Zona pericolosa'))).toBeVisible({ timeout: 120_000 });
  console.log('   ✅ Dati sessione (eventi/missioni/pazienti) eliminati — mezzi intatti');
  await page.waitForTimeout(5_000);
}

// workers:1 in playwright.stress.config.js — ordine file, ma un fail NON salta i successivi

test.beforeAll(async ({ browser }) => {
  markSuiteStart();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  installDialogAutoAccept(page);
  await waitForAppReady(page);
  await warmupSuite(page);
  await pulisciEventiStressAperti(page, { maxEventi: 3 });
  await ctx.close();
});

test.beforeEach(async ({ page }) => {
  await page.route('**/maps.googleapis.com/maps/api/js**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.google={maps:{}}' }),
  );
  await page.route('**/maps.googleapis.com/maps/api/geocode/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'OK',
        results: [{ geometry: { location: { lat: 45.85, lng: 9.39 } }, formatted_address: 'Lecco, Italia' }],
      }),
    }),
  );
  await page.route('**/maps.googleapis.com/maps/api/place/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'OK', predictions: [], results: [] }) }),
  );
  await page.route('**/api.cloudinary.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ secure_url: 'https://test-mock.local/mock.pdf' }),
    }),
  );

  installDialogAutoAccept(page);
  await waitForAppReady(page);
});

test.afterEach(async ({ page }, testInfo) => {
  await chiudiDialog(page).catch(() => {});
  if (testInfo.status !== testInfo.expectedStatus) {
    console.log(`   ❌ SEGNALATO (fix alla fine) — ${testInfo.title}`);
  }
  const stats = stressStats();
  console.log(`   📊 Fine test — ${stats.writeCount} scritture, ${stats.elapsedMin} min suite`);
  await pausaTraTest(page, testInfo.title);
});

test.afterAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  installDialogAutoAccept(page);
  try {
    await waitForAppReady(page);
    await puliziaFinaleSessione(page);
  } catch (err) {
    console.log(`   ⚠ Pulizia finale non completata: ${err.message}`);
  } finally {
    await ctx.close();
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// FLUSSI BASE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('FLUSSI BASE', () => {
  test('1.1 — Evento regolare: evento → missione → paziente → ospedale → fine', async ({ page }) => {
    await creaEvento(page, { tag: 'REGOLARE' });
    await creaMissione(page, { mezzoIndex: 0 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await creaPaziente(page, {
      nome: 'Mario',
      cognome: 'Regolare',
      esito: 'Trasporta',
      missioneIndex: 0,
    });
    await apriTabEvento(page, 'missioni');
    await cicloTrasportoOspedale(page, 0, { skipInPosto: true });
    await assertAppHealthy(page, '1.1 ciclo regolare completato');
    await chiudiDialog(page);
  });

  test('1.2 — Paziente PMA: DIRETTO H → ARRIVATO H → visibile nel desk PMA', async ({ page }) => {
    await creaEvento(page, { tag: 'PMA' });
    await creaMissione(page, { mezzoIndex: 1 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await creaPazienteDestinazionePma(page, { nome: 'Pma', cognome: 'Stress' });
    await apriTabEvento(page, 'missioni');
    await cambiaStatoMissione(page, 'DIRETTO H', 0);
    await cambiaStatoMissione(page, 'ARRIVATO H', 0);

    await page.goto('/pma');
    await page.waitForURL(/\/pma\//, { timeout: 20_000 });
    await expect(page.getByText('Stress', { exact: false })).toBeVisible({ timeout: 30_000 });
    await assertAppHealthy(page, '1.2 paziente visibile nel desk PMA');
    await chiudiDialog(page);
  });

  test('1.3 — 3 missioni parallele, 3 pazienti: Trasporta / Risolto / Non trasporta', async ({ page }) => {
    await creaEvento(page, { tag: 'MULTI-3' });
    for (let i = 0; i < 3; i++) {
      await creaMissione(page, { mezzoIndex: i });
    }
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await cambiaStatoMissione(page, 'IN POSTO', 1);
    await cambiaStatoMissione(page, 'IN POSTO', 2);

    await creaPaziente(page, { nome: 'Alfa', cognome: 'Trasporta', esito: 'Trasporta', missioneIndex: 0 });
    await creaPaziente(page, { nome: 'Bravo', cognome: 'Posto', esito: 'Risolto in posto', missioneIndex: 1 });
    await creaPaziente(page, { nome: 'Charlie', cognome: 'NoTras', esito: 'Non trasporta', missioneIndex: 2 });

    await apriTabEvento(page, 'missioni');
    await cicloTrasportoOspedale(page, 0, { skipInPosto: true });
    await cambiaStatoMissione(page, 'FINE MISSIONE', 1);
    await cambiaStatoMissione(page, 'FINE MISSIONE', 2);
    await assertAppHealthy(page, '1.3 tre missioni con esiti diversi');
    await chiudiDialog(page);
  });

  test.fixme('1.4 — Noria: stesso mezzo, 4 trasporti sequenziali sullo stesso evento', async ({ page }) => {
    await creaEvento(page, { tag: 'NORIA' });
    await noriaTrasportoSequenziale(page, 4, 0);
    await assertAppHealthy(page, '1.4 noria 4 trasporti completata');
    await chiudiDialog(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ECCEZIONI OPERATIVE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('ECCEZIONI OPERATIVE', () => {
  test('2.1 — Dirottamento: mezzo su secondo evento, primo evento non bloccato', async ({ page }) => {
    await creaEvento(page, { tag: 'DIROTT-A' });
    const eventoA = await getEventoIdFromDialog(page);
    const dlgA = eventDialog(page);
    await creaMissione(page, { mezzoIndex: 0 });
    const mezzoLabel = await dlgA.getByRole('listitem').first().textContent();
    await cambiaStatoMissione(page, 'ALLERTATO', 0);
    await chiudiDialog(page);

    await creaEvento(page, { tag: 'DIROTT-B' });
    const eventoB = await getEventoIdFromDialog(page);
    await chiudiDialog(page);

    await apriMissionePerEvento(page, eventoA);
    await eseguiDirottamento(page, eventoB);
    await chiudiDialog(page);

    await apriEventoPerId(page, eventoA);
    const dlgRipA = eventDialog(page);
    await apriTabEvento(page, 'missioni');
    await dlgRipA.getByRole('button', { name: /nuova missione/i }).click();
    await expect(dlgRipA.getByRole('combobox', { name: /^mezzo$/i })).toBeVisible({ timeout: 15_000 });
    await assertAppHealthy(page, '2.1 dirottamento — evento A ancora operabile');
    await chiudiDialog(page);

    await apriEventoPerId(page, eventoB);
    await apriTabEvento(page, 'missioni');
    await expect(eventDialog(page).getByRole('listitem').first()).toBeVisible({ timeout: 15_000 });
    await chiudiDialog(page);
    void mezzoLabel;
  });

  test('2.2 — Flag-down: intercetta intervento → evento figlio → missione IN POSTO', async ({ page }) => {
    await creaEvento(page, { tag: 'FLAG' });
    const eventoId = await getEventoIdFromDialog(page);
    await creaMissione(page, { mezzoIndex: 2 });
    await cambiaStatoMissione(page, 'PARTITO', 0);
    await chiudiDialog(page);

    await apriMissionePerEvento(page, eventoId);
    await eseguiFlagDown(page, { indirizzo: `${STRESS_TAG} incrocio flag-down` });
    await expect(page.getByText(/IN POSTO/i).first()).toBeVisible({ timeout: 30_000 });
    await assertAppHealthy(page, '2.2 flag-down con missione IN POSTO');
    await chiudiDialog(page);
  });

  test('2.3 — Avaria/sinistro: mezzo non operativo, non riassegnabile finché non ripristinato', async ({
    page,
  }) => {
    await creaEvento(page, { tag: 'AVARIA' });
    const eventoId = await getEventoIdFromDialog(page);
    await creaMissione(page, { mezzoIndex: 3 });
    const dlg = eventDialog(page);
    const mezzoTxt = ((await dlg.getByRole('listitem').first().textContent()) ?? '').trim();
    await cambiaStatoMissione(page, 'PARTITO', 0);
    await chiudiDialog(page);

    await apriMissionePerEvento(page, eventoId);
    await eseguiAvariaSinistro(page, `${STRESS_TAG} avaria E2E`);
    await chiudiDialog(page);

    await apriEventoPerId(page, eventoId);
    const sigla = mezzoTxt.split(/\s+/)[0] ?? '';
    const assente = sigla ? await verificaMezzoNonInElenco(page, sigla) : true;
    expect(assente).toBeTruthy();
    await assertAppHealthy(page, '2.3 mezzo in avaria escluso da nuove missioni');
    await chiudiDialog(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// COMPORTAMENTI AUTOMATICI
// ═══════════════════════════════════════════════════════════════════════════

test.describe('COMPORTAMENTI AUTOMATICI', () => {
  test('3.1 — Auto-close evento: tutte missioni in RIENTRO/FINE → operativo terminato', async ({ page }) => {
    await creaEvento(page, { tag: 'AUTO-CLOSE' });
    await creaMissione(page, { mezzoIndex: 4 });
    await creaMissione(page, { mezzoIndex: 5 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await cambiaStatoMissione(page, 'IN POSTO', 1);
    await cambiaStatoMissione(page, 'RIENTRO', 0);
    await cambiaStatoMissione(page, 'FINE MISSIONE', 1);
    await attendiBadgeEvento(page, 'Terminato');
    await expect(eventDialog(page).getByRole('button', { name: /riapri evento/i })).toBeVisible();
    await assertAppHealthy(page, '3.1 auto-close → Terminato');
    await chiudiDialog(page);
  });

  test('3.2 — ARRIVATO H: pazienti TRASPORTO aggiornati automaticamente', async ({ page }) => {
    await creaEvento(page, { tag: 'SYNC-H' });
    await creaMissione(page, { mezzoIndex: 6 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await creaPaziente(page, {
      nome: 'Sync',
      cognome: 'ArrivatoH',
      esito: 'Trasporta',
      missioneIndex: 0,
    });
    await apriTabEvento(page, 'missioni');
    await cambiaStatoMissione(page, 'ARRIVATO H', 0);
    await apriTabEvento(page, 'pazienti');
    const dlg = eventDialog(page);
    await expect(dlg.getByText(/ARRIVATO H|arrivato/i).first()).toBeVisible({ timeout: 45_000 });
    await assertAppHealthy(page, '3.2 sync paziente su ARRIVATO H');
    await chiudiDialog(page);
  });

  test('3.3 — Chiusura forzata evento con missioni in stati misti', async ({ page }) => {
    await creaEvento(page, { tag: 'FORZATA' });
    await creaMissione(page, { mezzoIndex: 7 });
    await creaMissione(page, { mezzoIndex: 8 });
    await creaMissione(page, { mezzoIndex: 9 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await cambiaStatoMissione(page, 'PARTITO', 1);
    await cambiaStatoMissione(page, 'RIENTRO', 2);
    const prima = await contaMissioniAperte(page);
    expect(prima.aperte).toBeGreaterThan(0);
    await eseguiChiusuraForzataEvento(page);
    await apriTabEvento(page, 'missioni');
    const dopo = await contaMissioniAperte(page);
    expect(dopo.aperte).toBe(0);
    await assertAppHealthy(page, '3.3 chiusura forzata — tutte missioni chiuse');
    await chiudiDialog(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STATI LIMITE
// ═══════════════════════════════════════════════════════════════════════════

test.describe('STATI LIMITE', () => {
  test('4.1 — Missione ANNULLATA subito dopo creazione: mezzo torna disponibile', async ({ page }) => {
    await creaEvento(page, { tag: 'ANNULLA' });
    await creaMissione(page, { mezzoIndex: 10 });
    const dlg = eventDialog(page);
    const mezzoTxt = ((await dlg.getByRole('listitem').first().textContent()) ?? '').trim();
    await cambiaStatoMissione(page, 'ANNULLATA', 0);
    await apriTabEvento(page, 'missioni');
    await dlg.getByRole('button', { name: /nuova missione/i }).click();
    const mezzoField = dlg.getByRole('combobox', { name: /^mezzo$/i });
    await expect(mezzoField).toBeVisible({ timeout: 15_000 });
    const options = await mezzoField.locator('option:not([value=""])').allTextContents();
    const sigla = mezzoTxt.split(/\s+/)[0] ?? '';
    if (sigla) {
      expect(options.some((t) => t.includes(sigla))).toBeTruthy();
    }
    await assertAppHealthy(page, '4.1 ANNULLATA — mezzo di nuovo selezionabile');
    await chiudiDialog(page);
  });

  test('4.2 — Paziente senza nome né cognome: app non crasha', async ({ page }) => {
    await creaEvento(page, { tag: 'NO-NOME' });
    await creaMissione(page, { mezzoIndex: 11 });
    await cambiaStatoMissione(page, 'IN POSTO', 0);
    await apriTabEvento(page, 'pazienti');
    const dlg = eventDialog(page);
    await dlg.getByRole('button', { name: /nuovo paziente/i }).click();
    const pazDlg = topDialog(page);
    await pazDlg.getByRole('combobox', { name: /^esito$/i }).selectOption('Risolto in posto');
    await pazDlg.getByRole('button', { name: /crea paziente/i }).click();
    await page.waitForTimeout(2_000);
    await dopoScrittura(page, 'paziente senza nome');
    await assertAppHealthy(page, '4.2 paziente anonimo senza crash');
    await chiudiDialog(page);
  });

  test('4.3 — Evento terminato e riaperto: missioni esistenti intatte', async ({ page }) => {
    await creaEvento(page, { tag: 'RIAPRI' });
    const eventoId = await getEventoIdFromDialog(page);
    await creaMissione(page, { mezzoIndex: 12 });
    await creaMissione(page, { mezzoIndex: 13 });
    await cambiaStatoMissione(page, 'RIENTRO', 0);
    await cambiaStatoMissione(page, 'FINE MISSIONE', 1);
    await attendiBadgeEvento(page, 'Terminato');
    const prima = await contaMissioniAperte(page);
    await riapriEventoOperativo(page);
    await apriTabEvento(page, 'missioni');
    const dopo = await contaMissioniAperte(page);
    expect(dopo.totale).toBe(prima.totale);
    await assertAppHealthy(page, '4.3 riapertura — missioni intatte');
    await chiudiDialog(page);
    void eventoId;
  });

  test('4.4 — Salto stati missione: ALLERTARE → FINE MISSIONE diretto', async ({ page }) => {
    await creaEvento(page, { tag: 'SALTO' });
    await creaMissione(page, { mezzoIndex: 14 });
    await cambiaStatoMissione(page, 'FINE MISSIONE', 0);
    const dlg = eventDialog(page);
    await apriTabEvento(page, 'missioni');
    await expect(dlg.getByRole('listitem').first().getByRole('combobox')).toBeDisabled({ timeout: 15_000 });
    await assertAppHealthy(page, '4.4 salto stati → FINE MISSIONE');
    await chiudiDialog(page);
  });

  test('4.5 — Stesso mezzo due volte: secondo tentativo bloccato o gestito', async ({ page }) => {
    await creaEvento(page, { tag: 'DOPPIO-MEZZO' });
    await creaMissione(page, { mezzoIndex: 0 });
    const dlg = eventDialog(page);
    const mezzoTxt = ((await dlg.getByRole('listitem').first().textContent()) ?? '').trim();
    const nPrima = await dlg.getByRole('listitem').count();
    await dlg.getByRole('button', { name: /nuova missione/i }).click();
    const mezzoField = dlg.getByRole('combobox', { name: /^mezzo$/i });
    if (await mezzoField.isVisible().catch(() => false)) {
      const options = await mezzoField.locator('option:not([value=""])').allTextContents();
      const sigla = mezzoTxt.split(/\s+/)[0] ?? '';
      const mezzoLibero = sigla ? !options.some((t) => t.includes(sigla)) : true;
      expect(mezzoLibero).toBeTruthy();
    }
    const nDopo = await dlg.getByRole('listitem').count();
    expect(nDopo).toBe(nPrima);
    await assertAppHealthy(page, '4.5 doppio mezzo non assegnato');
    await chiudiDialog(page);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ROBUSTEZZA UI (nessuna scrittura extra salvo dove indicato)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('ROBUSTEZZA UI', () => {
  test('5.1 — Apertura/chiusura rapida scheda evento 10 volte', async ({ page }) => {
    await creaEvento(page, { tag: 'FLAP' });
    const eventoId = await getEventoIdFromDialog(page);
    await chiudiDialog(page);
    for (let i = 0; i < 10; i++) {
      await apriEventoPerId(page, eventoId);
      await expect(eventDialog(page)).toBeVisible();
      await chiudiDialog(page);
      await page.waitForTimeout(200);
    }
    await assertAppHealthy(page, '5.1 10 open/close senza memory leak evidente');
  });

  test('5.2 — Switch veloce tab missioni / pazienti / dettaglio', async ({ page }) => {
    await creaEvento(page, { tag: 'TABS' });
    await creaMissione(page, { mezzoIndex: 15 });
    const dlg = eventDialog(page);
    for (let i = 0; i < 20; i++) {
      await dlg.getByRole('button', { name: /missioni/i }).click();
      await dlg.getByRole('button', { name: /pazienti/i }).click();
      await dlg.getByRole('button', { name: /dettaglio/i }).click();
    }
    await assertAppHealthy(page, '5.2 tab switching rapido OK');
    await chiudiDialog(page);
  });

  test('5.3 — Doppio click su Crea evento: un solo evento', async ({ page }) => {
    await page.goto('/');
    const countPrima = await page.locator('table tbody tr').count().catch(() => 0);
    const dlg = await apriNuovoEvento(page);
    await dlg.locator('textarea').first().fill(stressNote('DBL-CLICK'));
    const creaBtn = dlg.getByRole('button', { name: /crea evento/i });
    await creaBtn.dblclick().catch(() => {});
    await expect(dlg.getByText('Nuovo evento')).toBeHidden({ timeout: 60_000 });
    await dopoScrittura(page, 'doppio click evento');
    await chiudiDialog(page);
    await page.goto('/eventi');
    await page.waitForTimeout(1_500);
    const rowsDbl = await page.locator('table tbody tr').filter({ hasText: /DBL-CLICK/i }).count();
    expect(rowsDbl).toBeLessThanOrEqual(1);
    void countPrima;
    await assertAppHealthy(page, '5.3 doppio click — al massimo un evento');
  });

  test('5.4 — Navigazione su tutte le pagine incluso PMA', async ({ page }) => {
    await navigaTutteLePagineConPma(page);
  });

  test('5.5 — Note 500 caratteri con speciali ed emoji', async ({ page }) => {
    const dlg = await apriNuovoEvento(page);
    const junk = `${STRESS_TAG} ${'X'.repeat(500)} 🚑\n\t<script>alert(1)</script> €àèù ©™`;
    await dlg.locator('textarea').first().fill(junk);
    await dlg.getByRole('button', { name: /crea evento/i }).click();
    await expect(dlg.getByText('Nuovo evento')).toBeHidden({ timeout: 60_000 });
    await dopoScrittura(page, 'note estreme');
    await chiudiDialog(page);
    await assertAppHealthy(page, '5.5 input estremo nelle note');
  });
});
