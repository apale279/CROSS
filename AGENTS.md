# AGENTS.md

## Cursor Cloud specific instructions

### Product

CROSS is a React + Vite SPA for emergency medical services dispatch at events. Runtime stack: **Firebase Auth + Firestore** (cloud), **Vercel serverless** `/api/*` (optional locally via proxy), optional Google Maps / Cloudinary / Telegram.

### Services

| Service | Port | Command | Notes |
|---------|------|---------|-------|
| Vite dev server | 5320 | `npm run dev` | Primary local dev target |
| Vite preview | 4173 | `npm run preview` | After `npm run build` |

No Docker, Firebase emulators, or local database in this repo.

### First-time env file

Copy `.env.example` → `.env.local` and set at minimum the `VITE_FIREBASE_*` client vars. The Firebase web config is public (embedded in the production JS bundle); `VITE_TENANT_ID` is required when more than one document exists in Firestore `manifestazioni` (production uses `Lr4XjZMr4UWWJWD2m0iW`).

For Telegram, admin users, and server uploads during local dev, set `VITE_API_BASE_URL` to a deployed Vercel host (e.g. `https://cross-pied.vercel.app`) so Vite proxies `/api` — see `vite.config.js`.

Server-only secrets (`TELEGRAM_BOT_TOKEN`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `CLOUDINARY_*`) belong on Vercel, not in `.env.local`.

### Lint / test / build

| Task | Command | Notes |
|------|---------|-------|
| Critical import guard | `npm run verify:critical` | Runs before `npm run build` |
| Build | `npm run build` | Works without `.env.local` |
| Tests | `set -a && source .env.local && set +a && npx vitest run` | Vitest is **not** in `package.json`; Firebase env needed for tests that import `firebaseConfig.js` |
| Lint | — | No ESLint script configured |

Expect ~1 pre-existing failing unit test in `codiceMinoreMissione.test.js` and broken import paths in a few test files (`../src/lib/...`).

### Dev server

`npm run dev` binds `0.0.0.0:5320`. Login page: `/login`. Most routes require Firebase Authentication.

### Optional data scripts

`npm run seed:demo`, `npm run seed:prova`, and import scripts need `.env.local` and often `FIREBASE_SERVICE_ACCOUNT_JSON` for admin operations.

### Git hooks

Optional commit timestamp hook: `git config core.hooksPath .githooks` (see `.githooks/prepare-commit-msg`).
