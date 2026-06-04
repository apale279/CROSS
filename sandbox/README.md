# Sandbox CROSS (tenant Firestore separato)

Ambiente di prova sul **medesimo progetto Firebase** di produzione, con dati isolati in `manifestazioni/{SANDBOX_TENANT_ID}/`.

**Guida passo passo (italiano):** [GUIDA.md](./GUIDA.md)

- **Telegram:** disattivato (`telegramBotEnabled: false` nelle impostazioni sandbox).
- **Mappe / Cloudinary:** stesse chiavi env del progetto (Vercel o `.env.sandbox.local`).
- **Produzione:** non modificata; il tenant prod resta quello in `VITE_TENANT_ID` su main/Vercel production.
- **UI:** badge «Sandbox» accanto al logo (header + home), nessun banner fisso; blocco scritture sul tenant prod se `VITE_APP_SANDBOX=true`.

## Locale

```bash
npm run sandbox:create    # nuova root sandbox + file in sandbox/
npm run dev:sandbox       # app su porta 5321
```

Tenant attuale: `sandbox/TENANT_ID`

## Vercel (deploy sandbox dedicato)

Stesso repo GitHub, secondo progetto Vercel. Branch Production: **`sandbox`** (Settings → Environments → Production → Branch Tracking).

Vedi `env.sandbox.vercel.example` e la sezione C in [GUIDA.md](./GUIDA.md).

**Utenti operatori:** Impostazioni → Utenti (identico alla produzione). Primo login admin: `npm run sandbox:admin`.
