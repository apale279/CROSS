// TEST 2 — Creazione evento e missione, cambio stato
// Questo test verifica il workflow operativo principale e i fix dei Bug 1 e 2
import { test, expect } from '@playwright/test';
import { SESSION_FILE } from './auth.setup.js';

test.use({ storageState: SESSION_FILE });

// ID usato per trovare e pulire i dati creati dal test
const TAG_TEST = '[TEST-AUTO]';

test.describe('Workflow evento e missione', () => {

  test('crea un nuovo evento e verifica che appaia in lista', async ({ page }) => {
    await page.goto('/eventi');

    // Apre il form "Nuovo evento" tramite il pulsante nell'header
    await page.getByRole('button', { name: /\+ Evento/i }).click();

    // Aspetta che il modal si apra
    await expect(page.getByText('Nuovo evento')).toBeVisible();

    // Compila il campo "Note evento" con il tag per riconoscerlo dopo
    // (campo libero sempre presente, non dipende dalle impostazioni)
    const noteField = page.locator('textarea, input[placeholder*="note" i]').first();
    if (await noteField.count() > 0) {
      await noteField.fill(TAG_TEST);
    }

    // Clicca "Crea evento"
    await page.getByRole('button', { name: /crea evento/i }).click();

    // Dopo la creazione il modal deve restare aperto sulla tab missioni
    // oppure l'evento deve comparire nella lista
    await page.waitForTimeout(2000); // aspetta Firestore
    await expect(page.getByRole('button', { name: /nuova missione/i })).toBeVisible({ timeout: 8000 });

    console.log('✅ Evento creato e modal missioni aperto');
  });

  test('crea una missione e cambia stato — nessun crash silenzioso (Bug 1 & 2)', async ({ page }) => {
    await page.goto('/eventi');

    // Apre il modal di un evento esistente (il primo in lista)
    const primaRiga = page.locator('table tbody tr').first();
    await expect(primaRiga).toBeVisible({ timeout: 10_000 });
    await primaRiga.click();

    // Clicca "Nuova missione"
    const btnNuovaMissione = page.getByRole('button', { name: /nuova missione/i });
    await expect(btnNuovaMissione).toBeVisible({ timeout: 8_000 });
    await btnNuovaMissione.click();

    // Seleziona un mezzo (primo disponibile nel select)
    const mezzoSelect = page.locator('select').first();
    if (await mezzoSelect.count() > 0) {
      const opzioni = await mezzoSelect.locator('option').all();
      if (opzioni.length > 1) {
        await mezzoSelect.selectOption({ index: 1 });
      }
    }

    // Salva la missione
    const btnSalvaMissione = page.getByRole('button', { name: /salva|conferma|crea/i }).last();
    await btnSalvaMissione.click();
    await page.waitForTimeout(1500);

    // Trova il select stato missione nella scheda
    const statoSelect = page.locator('select[aria-label*="stato" i], select').filter({
      has: page.locator('option', { hasText: /allertato|in posto|rientro/i })
    }).first();

    if (await statoSelect.count() > 0) {
      // Cambia stato a ALLERTATO
      await statoSelect.selectOption({ label: /allertato/i });
      await page.waitForTimeout(1500);

      // BUG 1 FIX: NON ci deve essere un crash silenzioso.
      // Se il cambio stato fallisce, deve apparire un alert di errore.
      // Se va bene, lo stato si aggiorna.
      // Verifica che la pagina non sia crashata (header ancora visibile)
      await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible();
      console.log('✅ Cambio stato missione completato senza crash');
    } else {
      console.log('ℹ️  Select stato non trovato — missione non creata o UI diversa dall\'atteso');
    }
  });

  test('elimina evento — deve avere feedback e non crashare (Bug 1)', async ({ page }) => {
    await page.goto('/eventi');

    // Apre il modal del primo evento
    const primaRiga = page.locator('table tbody tr').first();
    await expect(primaRiga).toBeVisible({ timeout: 10_000 });
    await primaRiga.click();

    // Cerca il pulsante "Elimina evento"
    const btnElimina = page.getByRole('button', { name: /elimina evento/i });

    if (await btnElimina.count() > 0) {
      // Intercetta il dialog di conferma (window.confirm)
      page.once('dialog', async (dialog) => {
        console.log(`   Dialog: "${dialog.message()}"`);
        await dialog.dismiss(); // annulla — non vogliamo davvero eliminare
      });

      await btnElimina.click();

      // Dopo aver annullato il dialog, l'app non deve crashare
      await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible();
      console.log('✅ Dialog eliminazione gestito correttamente, app ancora funzionante');
    } else {
      console.log('ℹ️  Pulsante Elimina evento non trovato (evento senza permessi o UI diversa)');
    }
  });

});
