// @ts-check
/** Config Playwright dedicata allo stress test — auto-login, niente setup sessione. */
import { defineConfig, devices } from '@playwright/test';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

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

if (!process.env.TEST_EMAIL || !process.env.TEST_PASSWORD) {
  console.warn(
    '⚠️  Credenziali mancanti: crea .env.test con TEST_EMAIL e TEST_PASSWORD (vedi account test).',
  );
}

process.env.PW_STRESS_MODE = '1';

// Throttle scritture Firestore: 20s tra write, 60s tra test (suite ~60–90 min)
const stressWriteDelay = process.env.STRESS_WRITE_DELAY_MS ?? '20000';
const stressBetweenTests = process.env.STRESS_BETWEEN_TESTS_MS ?? '60000';
process.env.STRESS_WRITE_DELAY_MS = stressWriteDelay;
process.env.STRESS_BETWEEN_TESTS_MS = stressBetweenTests;
process.env.STRESS_CLEANUP_MAX = process.env.STRESS_CLEANUP_MAX ?? '3';
process.env.STRESS_CLEANUP_DELAY_MS = process.env.STRESS_CLEANUP_DELAY_MS ?? '15000';
process.env.STRESS_SUITE_WARMUP_MS = process.env.STRESS_SUITE_WARMUP_MS ?? '60000';
process.env.STRESS_QUOTA_RETRY_MS = process.env.STRESS_QUOTA_RETRY_MS ?? '90000';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /stress-test\.spec\.js/,
  globalTimeout: 7_200_000, // 2 h max suite (20 test + throttle)
  timeout: 1_200_000, // 20 min per test (throttle incluso)
  expect: { timeout: 45_000 },
  retries: 0,
  maxFailures: 0, // non interrompere la suite al primo fail
  workers: 1,

  use: {
    baseURL: 'http://localhost:5320',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'it-IT',
    actionTimeout: 15_000,
  },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5320',
    reuseExistingServer: false, // forza dev server con VITE_E2E_AUTO_LOGIN
    timeout: 60_000,
    env: {
      VITE_E2E_AUTO_LOGIN: 'true',
      VITE_E2E_TEST_EMAIL: process.env.TEST_EMAIL ?? '',
      VITE_E2E_TEST_PASSWORD: process.env.TEST_PASSWORD ?? '',
      STRESS_WRITE_DELAY_MS: stressWriteDelay,
      STRESS_BETWEEN_TESTS_MS: stressBetweenTests,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-stress', open: 'never' }],
  ],
});
