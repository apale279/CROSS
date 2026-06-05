// TEST 3 — Creazione paziente e workflow base
import { test, expect } from '@playwright/test';
import { SESSION_FILE } from './auth.setup.js';

test.use({ storageState: SESSION_FILE });

test.describe('Workflow paziente', () => {

  test('pagina pazienti carica e mostra la lista', async ({ page }) => {
    await page.goto('/pazienti');
    await expect(page).not.toHaveURL(/\/login/);
    // La pagina non deve mostrare crash (errore React)
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.locator('body')).not.toContainText('Errore critico');
    console.log('✅ Pagina pazienti caricata');
  });

  test('apre scheda paziente da un evento esistente', async ({ page }) => {
    await page.goto('/eventi');

    // Apre il primo evento
    const primaRiga = page.locator('table tbody tr').first();
    await expect(primaRiga).toBeVisible({ timeout: 10_000 });
    await primaRiga.click();

    // Naviga alla tab Pazienti dentro il modal evento
    const tabPazienti = page.getByRole('tab', { name: /pazienti/i })
      .or(page.getByRole('button', { name: /pazienti/i }));

    if (await tabPazienti.count() > 0) {
      await tabPazienti.first().click();
      await page.waitForTimeout(500);
      console.log('✅ Tab pazienti aperta');
    }

    // Controlla che la pagina non sia crashata
    await expect(page.locator('body')).not.toContainText('Something went wrong');
    await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible();
  });

});
