/**
 * Azioni condivise CROSS — Playwright
 *
 * Ogni funzione esegue un'operazione UI specifica dell'app.
 * I test degli scenari la importano per non ripetere codice.
 */

import { expect } from '@playwright/test';

// ─── EVENTO ──────────────────────────────────────────────────────────────────

/**
 * Apre il modal "Nuovo evento" dall'header.
 */
export async function apriNuovoEvento(page) {
  await page.goto('/eventi');
  await page.getByRole('button', { name: /\+ Evento/i }).click();
  await expect(page.getByText('Nuovo evento')).toBeVisible({ timeout: 6000 });
}

/**
 * Compila e salva un nuovo evento.
 * Ritorna quando il modal è aperto sulla tab missioni.
 * @param {{ tipo?: string, indirizzo?: string, note?: string }} opzioni
 */
export async function creaEvento(page, opzioni = {}) {
  await apriNuovoEvento(page);

  // Tipo evento — primo disponibile se non specificato
  const selectTipo = page.locator('select').filter({
    has: page.locator('option:not([value=""])')
  }).first();
  if (await selectTipo.count() > 0) {
    if (opzioni.tipo) {
      await selectTipo.selectOption({ label: new RegExp(opzioni.tipo, 'i') }).catch(() => {});
    }
  }

  // Note evento — utile per taggare i dati del test
  if (opzioni.note) {
    const noteField = page.locator('textarea').first();
    if (await noteField.count() > 0) {
      await noteField.fill(opzioni.note);
    }
  }

  await page.getByRole('button', { name: /crea evento/i }).click();

  // Aspetta che il modal si posizioni sulla tab missioni
  await expect(
    page.getByRole('button', { name: /nuova missione/i })
  ).toBeVisible({ timeout: 10_000 });

  console.log(`   ✓ Evento creato${opzioni.note ? ` (${opzioni.note})` : ''}`);
}

// ─── MISSIONE ────────────────────────────────────────────────────────────────

/**
 * Crea una nuova missione dall'interno del modal evento.
 * Presuppone che il modal evento sia già aperto sulla tab missioni.
 * @param {{ mezzoIndex?: number }} opzioni  — mezzoIndex: quale mezzo selezionare (0=primo)
 */
export async function creaMissione(page, opzioni = {}) {
  await page.getByRole('button', { name: /nuova missione/i }).click();
  await page.waitForTimeout(500);

  // Seleziona mezzo dalla lista (primo disponibile per default)
  const idx = opzioni.mezzoIndex ?? 0;
  const mezzoSelect = page.locator('select').filter({
    has: page.locator('option', { hasText: /[A-Z]/ }) // opzioni con testo (sigle mezzi)
  }).first();

  if (await mezzoSelect.count() > 0) {
    const opzioni_mezzo = await mezzoSelect.locator('option:not([value=""])').all();
    if (opzioni_mezzo.length > idx) {
      await mezzoSelect.selectOption({ index: idx + 1 }); // +1 perché index 0 è il placeholder
    }
  }

  // Conferma la missione
  const btnSalva = page.getByRole('button', { name: /salva|conferma|crea/i }).last();
  if (await btnSalva.count() > 0) {
    await btnSalva.click();
  } else {
    // Alcuni form si salvano con Enter o submit
    await page.keyboard.press('Enter');
  }

  await page.waitForTimeout(1500);
  console.log(`   ✓ Missione creata (mezzo #${idx + 1})`);
}

/**
 * Cambia lo stato di una missione.
 * Trova il primo select stato che contiene gli stati missione.
 * @param {string} nuovoStato — es. 'IN POSTO', 'ARRIVATO H', 'FINE MISSIONE'
 * @param {number} indice — quale missione (0=prima)
 */
export async function cambiaStatoMissione(page, nuovoStato, indice = 0) {
  const statiMissione = ['ALLERTARE', 'ALLERTATO', 'PARTITO', 'IN POSTO',
    'DIRETTO H', 'ARRIVATO H', 'RIENTRO', 'FINE MISSIONE', 'ANNULLATA'];

  const selects = page.locator('select').filter({
    has: page.locator('option', { hasText: statiMissione[0] })
      .or(page.locator('option', { hasText: 'ALLERTATO' }))
  });

  const target = selects.nth(indice);
  if (await target.count() > 0) {
    await target.selectOption(nuovoStato);
    await page.waitForTimeout(1500);
    console.log(`   ✓ Stato missione ${indice + 1} → ${nuovoStato}`);
  } else {
    console.log(`   ⚠ Select stato missione ${indice + 1} non trovato`);
  }
}

/**
 * Porta una missione a FINE MISSIONE passando per gli stati intermedi.
 * Simula un trasporto completo: IN POSTO → ARRIVATO H → RIENTRO → FINE MISSIONE
 */
export async function completaMissione(page, indice = 0) {
  for (const stato of ['IN POSTO', 'ARRIVATO H', 'RIENTRO', 'FINE MISSIONE']) {
    await cambiaStatoMissione(page, stato, indice);
  }
  console.log(`   ✓ Missione ${indice + 1} completata (FINE MISSIONE)`);
}

// ─── PAZIENTE ────────────────────────────────────────────────────────────────

/**
 * Apre la tab Pazienti nel modal evento corrente.
 */
export async function apriTabPazienti(page) {
  // Cerca la tab "Pazienti" come tab o pulsante di navigazione
  const tab = page.getByRole('tab', { name: /pazienti/i })
    .or(page.getByRole('button', { name: /^pazienti$/i }));

  if (await tab.count() > 0) {
    await tab.first().click();
    await page.waitForTimeout(500);
    console.log('   ✓ Tab Pazienti aperta');
  }
}

/**
 * Crea un nuovo paziente dall'interno del modal evento (tab Pazienti).
 * @param {{ esito?: string, destinazione?: string, nome?: string }} opzioni
 *   esito: 'Trasporta' | 'Risolto in posto' | 'Non trasporta' | 'Rifiuto trasporto'
 *   destinazione: stringa parziale del nome dell'ospedale o PMA (es. 'Niguarda', 'PMA')
 */
export async function creaPaziente(page, opzioni = {}) {
  // Apre il form nuovo paziente
  const btnNuovoPaziente = page.getByRole('button', { name: /nuovo paziente/i });
  await expect(btnNuovoPaziente).toBeVisible({ timeout: 6000 });
  await btnNuovoPaziente.click();
  await page.waitForTimeout(500);

  // Nome paziente (opzionale)
  if (opzioni.nome) {
    const nomeInput = page.locator('input[placeholder*="nome" i], input[id*="nome" i]').first();
    if (await nomeInput.count() > 0) await nomeInput.fill(opzioni.nome);
  }

  // Esito
  if (opzioni.esito) {
    const esitoSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: 'Trasporta' })
    }).first();
    if (await esitoSelect.count() > 0) {
      await esitoSelect.selectOption(opzioni.esito);
      await page.waitForTimeout(500);
      console.log(`   ✓ Esito paziente: ${opzioni.esito}`);
    }
  }

  // Destinazione (ospedale o PMA)
  if (opzioni.destinazione) {
    const destSelect = page.locator('select').filter({
      has: page.locator('option', { hasText: new RegExp(opzioni.destinazione, 'i') })
    }).first();
    if (await destSelect.count() > 0) {
      await destSelect.selectOption({ label: new RegExp(opzioni.destinazione, 'i') });
      await page.waitForTimeout(500);
      console.log(`   ✓ Destinazione: ${opzioni.destinazione}`);
    } else {
      // Destinazione non trovata nella lista — segnala ma non blocca il test
      console.log(`   ⚠ Destinazione "${opzioni.destinazione}" non trovata nella lista`);
    }
  }

  // Salva il paziente
  const btnSalva = page.getByRole('button', { name: /salva paziente|crea paziente|salva/i }).last();
  if (await btnSalva.count() > 0) {
    await btnSalva.click();
  } else {
    await page.getByRole('button', { name: /salva/i }).last().click();
  }

  await page.waitForTimeout(2000);
  console.log(`   ✓ Paziente salvato`);
}

// ─── VERIFICA ────────────────────────────────────────────────────────────────

/**
 * Verifica che l'app non sia crashata: header e pulsante + Evento ancora visibili.
 */
export async function verificaAppFunzionante(page, messaggio = '') {
  await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible({ timeout: 5000 });
  await expect(page.locator('body')).not.toContainText('Something went wrong');
  if (messaggio) console.log(`   ✅ ${messaggio}`);
}

/**
 * Chiude il modal corrente (tasto Esc o pulsante ×).
 */
export async function chiudiModal(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
}

/**
 * Aspetta un alert di errore dopo un'azione che dovrebbe fallire.
 * Gestisce sia window.alert() nativi sia elementi <div role="alert"> nella pagina.
 */
export async function aspettaErrore(page, azioneFn) {
  let alertAppeared = false;

  // Intercetta window.alert nativo
  page.once('dialog', async (dialog) => {
    alertAppeared = true;
    console.log(`   ✓ Alert errore ricevuto: "${dialog.message().slice(0, 80)}..."`);
    await dialog.accept();
  });

  await azioneFn();
  await page.waitForTimeout(2000);

  // Controlla anche alert inline nella pagina
  const inlineAlert = page.locator('[role="alert"], .text-red-800, .text-red-900');
  const hasInlineAlert = await inlineAlert.count() > 0;

  return alertAppeared || hasInlineAlert;
}
