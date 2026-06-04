/**
 * Avvia Vite in modalità sandbox (porta 5321) caricando sandbox/.env.sandbox.local
 * senza toccare .env.local di produzione.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SANDBOX_ENV = join(ROOT, 'sandbox', '.env.sandbox.local');

function loadEnvFile(filePath) {
  const env = {};
  for (const raw of readFileSync(filePath, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

if (!existsSync(SANDBOX_ENV)) {
  console.error('\n❌  Manca sandbox/.env.sandbox.local — esegui prima: npm run sandbox:create\n');
  process.exit(1);
}

for (const [key, val] of Object.entries(loadEnvFile(SANDBOX_ENV))) {
  process.env[key] = val;
}

const tenantId = process.env.VITE_TENANT_ID?.trim();
const prodTenant = process.env.VITE_PRODUCTION_TENANT_ID?.trim();
const sandboxFlag = (process.env.VITE_APP_SANDBOX ?? '').trim().toLowerCase();

if (!tenantId) {
  console.error('\n❌  VITE_TENANT_ID mancante in sandbox/.env.sandbox.local\n');
  process.exit(1);
}
if (sandboxFlag !== 'true' && sandboxFlag !== '1') {
  console.warn('\n⚠️  VITE_APP_SANDBOX non è true — badge e blocco DB prod potrebbero non attivarsi.');
  console.warn('   Esegui: npm run sandbox:create\n');
}
if (prodTenant && tenantId === prodTenant) {
  console.error('\n❌  VITE_TENANT_ID coincide con VITE_PRODUCTION_TENANT_ID (tenant produzione).');
  console.error('   Esegui npm run sandbox:create o correggi sandbox/.env.sandbox.local\n');
  process.exit(1);
}

console.log(`\n🧪  Sandbox dev — tenant ${tenantId} — http://localhost:5321/\n`);

const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(
  process.execPath,
  [viteBin, '--host', '0.0.0.0', '--port', '5321'],
  { stdio: 'inherit', env: process.env, cwd: ROOT },
);

child.on('exit', (code) => process.exit(code ?? 0));
