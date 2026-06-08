/**
 * Helper UI CROSS per stress test E2E.
 * Tutte le azioni usano la dashboard (/) per + Evento e scope sui dialog.
 */
import { expect } from '@playwright/test';
import {
  STRESS_CLEANUP_DELAY_MS,
  STRESS_CLEANUP_MAX,
  STRESS_QUOTA_MAX_RETRIES,
  attendiQuotaFirestore,
  dopoScrittura,
} from './stress-throttle.js';

export const STRESS_TAG = '[STRESS]';

export function stressNote(tag) {
  return `${STRESS_TAG} ${tag}`.trim();
}

/** Dialog scheda evento (il primo dialog aperto). */
export function eventDialog(page) {
  return page.getByRole('dialog').first();
}

/** Dialog più recente (es. paziente sopra evento). */
export function topDialog(page) {
  return page.getByRole('dialog').last();
}

/** Accetta automaticamente alert/confirm nativi per tutta la sessione test. */
let lastQuotaSignalAt = 0;

export function installDialogAutoAccept(page) {
  page.on('dialog', (d) => {
    const msg = d.message();
    console.log(`   ⚠ Dialog: ${msg}`);
    if (/quota exceeded/i.test(msg)) lastQuotaSignalAt = Date.now();
    void d.accept().catch(() => {});
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') console.log(`   ⚠ Browser error: ${text}`);
    if (/429|quota exceeded/i.test(text)) lastQuotaSignalAt = Date.now();
  });
}

function quotaSegnalataDiRecente() {
  return lastQuotaSignalAt > 0 && Date.now() - lastQuotaSignalAt < 120_000;
}

async function ritentaDopoQuota(page, action, label) {
  let lastErr;
  for (let attempt = 0; attempt <= STRESS_QUOTA_MAX_RETRIES; attempt++) {
    lastQuotaSignalAt = 0;
    try {
      await action();
      if (!quotaSegnalataDiRecente()) return;
    } catch (err) {
      lastErr = err;
      if (!quotaSegnalataDiRecente() && attempt >= STRESS_QUOTA_MAX_RETRIES) throw err;
    }
    if (attempt >= STRESS_QUOTA_MAX_RETRIES) {
      throw lastErr ?? new Error(`Firestore quota exceeded — ${label}`);
    }
    await attendiQuotaFirestore(page, label);
  }
}

export async function waitForAppReady(page) {
  await page.goto('/');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 });
  await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('last-activity')) localStorage.setItem(key, Date.now().toString());
    }
  });
}

export async function assertAppHealthy(page, label = '') {
  await expect(page.locator('body')).not.toContainText('Something went wrong');
  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 8_000 });
  if (label) console.log(`   ✅ ${label}`);
}

export async function apriNuovoEvento(page) {
  await page.goto('/');
  await page.getByRole('button', { name: /\+ Evento/i }).click();
  const dlg = eventDialog(page);
  await expect(dlg.getByText('Nuovo evento')).toBeVisible({ timeout: 10_000 });
  return dlg;
}

export async function creaEvento(page, { tag = '', note = '' } = {}) {
  const noteText = note || (tag ? stressNote(tag) : '');
  const dlg = await apriNuovoEvento(page);
  if (noteText) {
    const textarea = dlg.locator('textarea').first();
    if (await textarea.count()) await textarea.fill(noteText);
  }
  const creaBtn = dlg.getByRole('button', { name: /crea evento/i });
  await ritentaDopoQuota(page, async () => {
    const ancoraNuovo = await dlg.getByText('Nuovo evento').isVisible().catch(() => false);
    if (ancoraNuovo) {
      await creaBtn.click();
    }
    await expect(dlg.getByText('Nuovo evento')).toBeHidden({ timeout: 60_000 });
  }, 'crea evento');
  await dlg.getByRole('button', { name: /missioni/i }).click();
  await expect(dlg.getByRole('button', { name: /nuova missione/i })).toBeVisible({ timeout: 20_000 });
  console.log(`   ✓ Evento creato${tag ? `: ${tag}` : ''}`);
  await dopoScrittura(page, 'evento creato');
  return dlg;
}

export async function apriTabEvento(page, tabName) {
  const dlg = eventDialog(page);
  await dlg.getByRole('button', { name: new RegExp(tabName, 'i') }).click();
  await page.waitForTimeout(400);
  return dlg;
}

async function leggiOpzioniMezzo(mezzoField) {
  return mezzoField.locator('option:not([value=""])').all();
}

export async function creaMissione(page, { mezzoIndex = 0 } = {}) {
  const dlg = eventDialog(page);
  await apriTabEvento(page, 'missioni');
  const missioni = dlg.getByRole('listitem');
  const nBefore = await missioni.count();

  const nuovaBtn = dlg.getByRole('button', { name: /nuova missione/i });
  await nuovaBtn.click();
  await page.waitForTimeout(500);

  const mezzoField = dlg.getByRole('combobox', { name: /^mezzo$/i });
  if (!(await mezzoField.isVisible().catch(() => false))) {
    await nuovaBtn.click();
    await page.waitForTimeout(400);
  }
  await mezzoField.waitFor({ state: 'visible', timeout: 15_000 });

  let options = [];
  for (let attempt = 0; attempt < 12; attempt++) {
    options = await leggiOpzioniMezzo(mezzoField);
    if (options.length) break;
    await page.waitForTimeout(4_000);
  }
  if (!options.length) {
    const eventoId = await getEventoIdFromDialog(page);
    console.log(`   ⚠ Nessun mezzo libero — chiusura eventi vecchi (mantengo ${eventoId ?? '?'})`);
    await chiudiDialog(page);
    await pulisciEventiStressAperti(page, { maxEventi: 10, skipEventoId: eventoId ?? undefined });
    if (eventoId) {
      await apriEventoPerId(page, eventoId);
      await apriTabEvento(page, 'missioni');
      await nuovaBtn.click();
      await mezzoField.waitFor({ state: 'visible', timeout: 15_000 });
      options = await leggiOpzioniMezzo(mezzoField);
    }
  }
  if (!options.length) {
    throw new Error('Nessun mezzo disponibile — chiudere manualmente eventi aperti con missioni attive');
  }

  const pick = Math.min(mezzoIndex, options.length - 1);
  const val = await options[pick].getAttribute('value');
  const label = ((await options[pick].textContent()) ?? '').trim();
  await mezzoField.selectOption(val ?? { index: pick + 1 });
  await dlg.getByRole('button', { name: /^invia$/i }).click();
  await expect(missioni).toHaveCount(nBefore + 1, { timeout: 30_000 });
  console.log(`   ✓ Missione creata (${label || `mezzo #${pick + 1}`})`);
  await dopoScrittura(page, 'missione creata');
}

/** Chiude l'evento aperto nel dialog corrente (libera i mezzi). */
export async function chiudiEventoCorrente(page, nota = `${STRESS_TAG} fine test`) {
  const dlg = eventDialog(page);
  if (!(await dlg.isVisible().catch(() => false))) return false;
  const chiudiBtn = dlg.getByRole('button', { name: /^chiudi evento$/i });
  if (!(await chiudiBtn.isVisible().catch(() => false))) return false;
  await chiudiBtn.click();
  await dlg.locator('textarea').last().fill(nota);
  await dlg.getByRole('button', { name: /conferma chiusura evento/i }).click();
  await dopoScrittura(page, 'evento chiuso');
  return true;
}

/** Chiude eventi aperti (più vecchi prima) per liberare mezzi. `skipEventoId` es. E69 = non chiudere. */
export async function pulisciEventiStressAperti(
  page,
  { maxEventi = STRESS_CLEANUP_MAX, skipEventoId = null } = {},
) {
  await page.goto('/eventi');
  await expect(page.getByRole('heading', { name: /eventi/i })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1_000);
  let chiusi = 0;
  for (let i = 0; i < maxEventi; i++) {
    const rows = page.locator('table tbody tr').filter({ hasText: /^Aperto$/ });
    const n = await rows.count();
    if (!n) break;
    let row = null;
    for (let j = n - 1; j >= 0; j--) {
      const candidate = rows.nth(j);
      const idText = ((await candidate.locator('td').first().textContent()) ?? '').trim();
      if (skipEventoId && idText === skipEventoId) continue;
      row = candidate;
      break;
    }
    if (!row) break;
    await row.click();
    const dlg = eventDialog(page);
    await expect(dlg).toBeVisible({ timeout: 10_000 });
    const chiudiBtn = dlg.getByRole('button', { name: /^chiudi evento$/i });
    if (!(await chiudiBtn.isVisible().catch(() => false))) {
      await chiudiDialog(page);
      await page.goto('/eventi');
      continue;
    }
    await chiudiBtn.click();
    await dlg.locator('textarea').last().fill(`${STRESS_TAG} cleanup E2E`);
    await dlg.getByRole('button', { name: /conferma chiusura evento/i }).click();
    chiusi += 1;
    await dopoScrittura(page, `cleanup evento ${chiusi}/${maxEventi}`);
    await page.goto('/eventi');
    await page.waitForTimeout(STRESS_CLEANUP_DELAY_MS);
  }
  if (chiusi > 0) {
    console.log(`   ♻ ${chiusi} eventi aperti chiusi (cleanup leggero, mezzi liberati)`);
  }
  return chiusi;
}

function statoMissioneField(dlg, indice = 0) {
  return dlg.getByRole('listitem').getByRole('combobox').nth(indice);
}

export async function cambiaStatoMissione(page, nuovoStato, indice = 0) {
  const dlg = eventDialog(page);
  const sel = statoMissioneField(dlg, indice);
  await expect(sel).toBeVisible({ timeout: 10_000 });
  const opzioni = await sel.locator('option').allTextContents();
  if (!opzioni.includes(nuovoStato)) {
    console.log(`   ⚠ Opzione "${nuovoStato}" non disponibile nel select`);
    return;
  }
  await sel.selectOption(nuovoStato);
  console.log(`   ✓ Stato missione #${indice + 1} → ${nuovoStato}`);
  await dopoScrittura(page, `stato → ${nuovoStato}`);
}

/** Salta le missioni chiuse (select disabilitato). */
export async function cambiaStatoMissioneAperta(page, nuovoStato, indiceAperte = 0) {
  const dlg = eventDialog(page);
  const items = dlg.getByRole('listitem');
  const n = await items.count();
  let seen = 0;
  for (let i = 0; i < n; i++) {
    const sel = items.nth(i).getByRole('combobox');
    if (await sel.isDisabled()) continue;
    if (seen === indiceAperte) {
      await sel.selectOption(nuovoStato);
      console.log(`   ✓ Stato missione aperta #${indiceAperte + 1} → ${nuovoStato}`);
      await dopoScrittura(page, `stato aperta → ${nuovoStato}`);
      return;
    }
    seen += 1;
  }
  throw new Error(`Nessuna missione aperta all'indice ${indiceAperte}`);
}

async function selectConOpzione(container, optionText, indice = 0) {
  const combo = container.getByRole('combobox').filter({
    has: container.getByRole('option', { hasText: optionText }),
  }).nth(indice);
  if (await combo.count()) {
    await combo.selectOption(optionText);
    return true;
  }
  const sel = container.locator('select').filter({
    has: container.locator('option', { hasText: optionText }),
  }).nth(indice);
  if (await sel.count()) {
    await sel.selectOption(optionText);
    return true;
  }
  return false;
}

async function selectPrimaOpzioneNonVuota(container, label, indice = 0) {
  const field = container
    .getByRole('combobox', { name: new RegExp(label, 'i') })
    .or(container.getByLabel(new RegExp(label, 'i')));
  if (!(await field.count())) return false;
  const target = field.nth(indice);
  const opts = await target.locator('option:not([value=""])').all();
  if (opts.length > 0) {
    await target.selectOption({ index: 1 });
    return true;
  }
  return false;
}

export async function creaPaziente(
  page,
  { nome = 'Stress', cognome = 'Test', esito = 'Trasporta', missioneIndex = 0 } = {},
) {
  await apriTabEvento(page, 'pazienti');
  const dlg = eventDialog(page);
  await dlg.getByRole('button', { name: /nuovo paziente/i }).click();

  const pazDlg = topDialog(page);
  await expect(pazDlg.getByRole('heading', { name: /nuovo paziente/i })).toBeVisible({
    timeout: 10_000,
  });

  const nomeInput = pazDlg.getByLabel(/^nome$/i).or(pazDlg.locator('label:has-text("Nome") input'));
  const cognomeInput = pazDlg.getByLabel(/^cognome$/i).or(pazDlg.locator('label:has-text("Cognome") input'));
  await nomeInput.first().fill(nome);
  await cognomeInput.first().fill(cognome);

  if (esito) {
    const esitoField = pazDlg.getByRole('combobox', { name: /^esito$/i });
    await esitoField.selectOption(esito);
    await page.waitForTimeout(800);
  }

  if (esito === 'Trasporta') {
    const missionField = pazDlg.getByRole('combobox', { name: /^missione/i });
    await missionField.waitFor({ state: 'visible', timeout: 10_000 });
    const opts = await missionField.locator('option:not([value=""])').all();
    const pick = opts.length > missioneIndex ? missioneIndex + 1 : 1;
    if (opts.length > 0) await missionField.selectOption({ index: pick });
    await page.waitForTimeout(600);
    const ospedale = pazDlg.getByRole('combobox', { name: /ospedale destinazione/i });
    if (await ospedale.isEnabled().catch(() => false)) {
      const hopts = await ospedale.locator('option:not([value=""])').all();
      if (hopts.length > 0) await ospedale.selectOption({ index: 1 });
    }
  }

  await pazDlg.getByRole('button', { name: /crea paziente/i }).click();
  await page.waitForTimeout(2_500);
  await expect(pazDlg.getByRole('heading', { name: /nuovo paziente/i })).toBeHidden({
    timeout: 20_000,
  });
  await expect(eventDialog(page).getByRole('button', { name: /pazienti \(\d+\)/i })).toBeVisible();
  console.log(`   ✓ Paziente creato: ${cognome} ${nome} (${esito})`);
  await dopoScrittura(page, 'paziente creato');
}

export async function chiudiDialog(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

export async function getEventoIdFromDialog(page) {
  const dlg = eventDialog(page);
  const title = await dlg.getByRole('heading').first().textContent();
  const match = title?.match(/E\d+/i);
  return match?.[0] ?? null;
}

export async function apriEventoPerId(page, idEvento) {
  await page.goto('/eventi');
  await expect(page.getByRole('heading', { name: /eventi/i })).toBeVisible();
  const row = page.locator('table tbody tr').filter({ hasText: idEvento }).first();
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.click();
  await expect(eventDialog(page)).toBeVisible({ timeout: 10_000 });
}

/** @deprecated Preferisci apriEventoPerId — il tag note non è visibile in tabella */
export async function apriEventoPerTag(page, tag) {
  await page.goto('/eventi');
  const row = page.locator('table tbody tr').filter({ hasText: stressNote(tag) }).first();
  if (await row.count()) {
    await row.click();
  } else {
    await page.locator('table tbody tr').first().click();
  }
  await expect(eventDialog(page)).toBeVisible({ timeout: 10_000 });
}

export async function apriMissionePerEvento(page, idEvento) {
  await page.goto('/missioni');
  await expect(page.getByRole('heading', { name: /missioni/i })).toBeVisible();
  const row = page.locator('table tbody tr').filter({ hasText: idEvento }).first();
  if (await row.count()) {
    await row.click();
  } else {
    await page.locator('table tbody tr').first().click();
  }
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
}

export async function apriEccezioniOperative(page) {
  const dlg = page.getByRole('dialog');
  const summary = dlg.getByText('Eccezioni operative');
  await summary.click();
  await page.waitForTimeout(300);
}

export async function eseguiDirottamento(page, idEventoDest) {
  const dlg = page.getByRole('dialog');
  await apriEccezioniOperative(page);
  const select = dlg.getByRole('combobox').filter({
    has: dlg.getByRole('option', { hasText: idEventoDest }),
  }).first();
  const options = await select.locator('option:not([value=""])').all();
  for (let i = 0; i < options.length; i++) {
    const text = (await options[i].textContent()) ?? '';
    if (text.includes(idEventoDest)) {
      await select.selectOption({ index: i + 1 });
      break;
    }
  }
  await dlg.getByRole('button', { name: /esegui dirottamento/i }).click();
  console.log('   ✓ Dirottamento eseguito');
  await dopoScrittura(page, 'dirottamento');
}

export async function eseguiFlagDown(page, { indirizzo = 'Via Stress Test 1' } = {}) {
  const dlg = page.getByRole('dialog');
  await apriEccezioniOperative(page);
  await dlg.getByPlaceholder(/incrocio via roma/i).fill(indirizzo);
  await dlg.getByRole('button', { name: /crea evento figlio e missione in posto/i }).click();
  console.log('   ✓ Flag-down eseguito');
  await dopoScrittura(page, 'flag-down');
}

export async function eseguiAvariaSinistro(page, nota = 'Test stress avaria') {
  const dlg = page.getByRole('dialog');
  await apriEccezioniOperative(page);
  await dlg.locator('textarea').first().fill(nota);
  await dlg.getByRole('button', { name: /registra avaria/i }).click();
  console.log('   ✓ Avaria/sinistro registrato');
  await dopoScrittura(page, 'avaria/sinistro');
}

/** Porta una missione al termine con percorso ospedale. */
export async function cicloTrasportoOspedale(page, missioneIndex = 0, { skipInPosto = false } = {}) {
  if (!skipInPosto) await cambiaStatoMissione(page, 'IN POSTO', missioneIndex);
  await cambiaStatoMissione(page, 'ARRIVATO H', missioneIndex);
  await cambiaStatoMissione(page, 'RIENTRO', missioneIndex);
  await cambiaStatoMissione(page, 'FINE MISSIONE', missioneIndex);
}

export async function navigaTutteLePagine(page) {
  const routes = ['/', '/diario', '/eventi', '/missioni', '/pazienti', '/mezzi', '/impostazioni'];
  for (const route of routes) {
    await page.goto(route);
    await page.waitForTimeout(600);
    await assertAppHealthy(page);
  }
  console.log('   ✓ Navigazione completa senza crash');
}
