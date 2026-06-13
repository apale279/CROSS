# AGENTS.md

## Cursor Cloud specific instructions

CROSS is a single-package Vite + React 19 app (not a monorepo). Operational docs live in `GUIDA.md`; environment template in `.env.example`.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| Web frontend (primary) | `npm run dev` | 5320 | Host `0.0.0.0`, `strictPort: true` |
| Production preview | `npm run build && npm run preview` | 4173 | Serves `dist/` |
| Vercel API (optional local) | `vercel dev` | 3000 | Only needed to run `api/*.js` locally; otherwise set `VITE_API_BASE_URL` to a deployed Vercel URL and Vite proxies `/api` |

Firebase (Auth + Firestore) is cloud-hosted (`cross-8bb72`). No emulators or Docker are configured.

### First-time / missing `.env.local`

Copy `.env.example` to `.env.local` and fill at minimum the `VITE_FIREBASE_*` client keys plus `VITE_API_BASE_URL` (deployed Vercel app for API proxy). `VITE_TENANT_ID` is optional: if omitted, the app auto-selects the sole `manifestazioni` document or the first when several exist.

Server-only secrets (`FIREBASE_SERVICE_ACCOUNT_JSON`, `TELEGRAM_BOT_TOKEN`, `CLOUDINARY_*`) belong in Vercel env vars or `.env.local` for CLI scripts — never prefix them with `VITE_`.

### Verify / test / build

- `npm run verify:critical` — fast import sanity check (also runs before `npm run build`)
- `npm run build` — production bundle to `dist/`
- Unit tests use Vitest but there is no `npm test` script; run `npx vitest run` (49 files; one pre-existing failure in `codiceMinoreMissione.test.js` as of setup)
- No ESLint/`npm run lint` script in this repo

### Seed / admin scripts

Require `FIREBASE_SERVICE_ACCOUNT_JSON` in `.env.local`: `npm run seed:demo`, `npm run seed:prova`, `scripts/create-operator-users.mjs`, etc.

### Gotchas

- Without `VITE_FIREBASE_*`, the app crashes on Firebase `initializeApp`.
- Without `VITE_API_BASE_URL`, `/api/*` calls from the browser fail in local dev (Telegram, uploads, admin users).
- Google Maps shows a degraded state without `VITE_GOOGLE_MAPS_API_KEY`; core ops still work.
- Git hooks: optional `git config core.hooksPath .githooks` (see `.githooks/prepare-commit-msg`).
