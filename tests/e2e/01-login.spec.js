// TEST 1 — Login e navigazione base
// Verifica che il login funzioni e che le pagine principali siano raggiungibili
import { test, expect } from '@playwright/test';
import { SESSION_FILE } from './auth.setup.js';

test.use({ storageState: SESSION_FILE });

test('login riuscito — dashboard visibile', async ({ page }) => {
  await page.goto('/');
  // Non deve rimandare al login
  await expect(page).not.toHaveURL(/\/login/);
  // Deve esserci il pulsante "+ Evento" nell'header
  await expect(page.getByRole('button', { name: /\+ Evento/i })).toBeVisible();
});

test('navigazione eventi — pagina carica senza errori', async ({ page }) => {
  await page.goto('/eventi');
  await expect(page).not.toHaveURL(/\/login/);
  // L'intestazione "Eventi" deve essere presente
  await expect(page.getByRole('heading', { name: /eventi/i })).toBeVisible();
});

test('navigazione missioni — pagina carica senza errori', async ({ page }) => {
  await page.goto('/missioni');
  await expect(page).not.toHaveURL(/\/login/);
});

test('navigazione mezzi — pagina carica senza errori', async ({ page }) => {
  await page.goto('/mezzi');
  await expect(page).not.toHaveURL(/\/login/);
});

test('navigazione pazienti — pagina carica senza errori', async ({ page }) => {
  await page.goto('/pazienti');
  await expect(page).not.toHaveURL(/\/login/);
});
