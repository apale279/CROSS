// Setup condiviso: login e salvataggio sessione
// Viene eseguito una volta sola prima di tutti i test
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SESSION_FILE = path.join(__dirname, '.auth-session.json');

setup('autenticazione account test', async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'Credenziali mancanti. Crea il file .env.test con TEST_EMAIL e TEST_PASSWORD. ' +
      'Vedi .env.test.example per le istruzioni.'
    );
  }

  await page.goto('/login');
  await expect(page.locator('#login-email')).toBeVisible();

  await page.fill('#login-email', email);
  await page.fill('#login-pass', password);
  await page.click('button[type="submit"]');

  // Aspetta che il login sia completato (URL cambia da /login)
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
  await expect(page).not.toHaveURL(/\/login/);

  // Salva la sessione (cookie + localStorage) per riusarla nei test
  await page.context().storageState({ path: SESSION_FILE });
  console.log('✅ Login effettuato, sessione salvata.');
});
