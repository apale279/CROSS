// @ts-check
import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Carica .env.test se esiste
const envTestPath = path.resolve('.env.test');
if (existsSync(envTestPath)) {
  const lines = readFileSync(envTestPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  }
}

const SESSION_FILE = './tests/e2e/.auth-session.json';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 40_000,
  expect: { timeout: 8_000 },
  retries: 1,
  workers: 1, // un test alla volta — evita conflitti sul DB

  use: {
    baseURL: 'http://localhost:5320',
    headless: false,        // visibile: vedi cosa fa il browser
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'it-IT',
    actionTimeout: 10_000,
  },

  // Avvia il dev server automaticamente se non è già attivo
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5320',
    reuseExistingServer: true, // se hai già `npm run dev` aperto, lo riusa
    timeout: 30_000,
  },

  projects: [
    // Step 1: login e salvataggio sessione (gira una volta sola)
    {
      name: 'setup',
      testMatch: /auth\.setup\.js/,
    },
    // Step 2: tutti i test veri (usano la sessione salvata)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: SESSION_FILE,
      },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.js/,
    },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
  ],
});
