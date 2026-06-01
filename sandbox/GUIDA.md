# Guida sandbox — passo passo (senza programmare)

La **sandbox** è una copia **separata** dei dati dell’evento (eventi, missioni, pazienti vuoti), sullo **stesso Firebase** del sito vero. Puoi provare funzioni senza rischiare la produzione.

| | Sito vero (produzione) | Sandbox (prove) |
|---|------------------------|-----------------|
| Dove gira in locale | `npm run dev` → porta **5320** | `npm run dev:sandbox` → porta **5321** |
| Dati su Firebase | tenant produzione | tenant sandbox (altro ID) |
| Telegram | come in produzione | **spento** |
| Mappe e Cloudinary | sì | sì (stesse chiavi) |

**ID tenant sandbox attuale:** leggi il file `sandbox/TENANT_ID` (una riga di testo).

---

## A. Aprire la sandbox sul tuo PC (ogni volta che vuoi provare)

### Passo 1 — Apri il terminale in Cursor

1. Apri il progetto **CROSS** in Cursor.
2. Menu in alto: **Terminal** → **New Terminal** (oppure tasto `` Ctrl+` ``).
3. In basso compare una finestra nera: è il terminale.

### Passo 2 — Vai nella cartella del progetto (se serve)

Se vedi già qualcosa tipo `C:\App_mie\CROSS`, vai al passo 3.

Altrimenti scrivi (poi Invio):

```text
cd C:\App_mie\CROSS
```

### Passo 3 — Avvia la sandbox

Scrivi (poi Invio):

```text
npm run dev:sandbox
```

Aspetta finché compare una riga simile a:

```text
Local:   http://localhost:5321/
```

**Non chiudere** quella finestra mentre usi la sandbox (è il “motore” dell’app).

### Passo 4 — Apri il browser

1. Apri Chrome (o Edge).
2. Nella barra indirizzi scrivi: **http://localhost:5321/**
3. Accedi come fai di solito (stesso login Firebase).

### Passo 5 — Controlla di essere in sandbox

Nelle impostazioni o nel nome manifestazione dovresti vedere qualcosa con **SANDBOX**.  
I dati che crei qui **non** sono quelli del sito online vero.

### Passo 6 — Quando hai finito

Nel terminale premi **Ctrl+C** per fermare il server sandbox.

---

## B. Ricreare una sandbox “pulita” (zero eventi/missioni/pazienti)

Usa questo solo se vuoi **un nuovo contenitore vuoto** (la vecchia sandbox su Firebase resta, ma il PC userà la nuova).

1. Terminale nella cartella `C:\App_mie\CROSS`.
2. Esegui:

```text
npm run sandbox:create
```

3. Poi di nuovo: `npm run dev:sandbox` e apri **http://localhost:5321/**

La produzione **non** viene modificata.

---

## C. Sito online di prova (Vercel) — da fare tu

Serve solo se vuoi la sandbox **su internet**, non solo sul PC.

1. Vai su [vercel.com](https://vercel.com) e accedi.
2. **Add New… → Project** e collega di nuovo il repository **CROSS** (secondo progetto, nome tipo `cross-sandbox`).
3. Nelle **Environment Variables** del **nuovo** progetto:
   - Copia da produzione: Firebase, Google Maps, Cloudinary, `FIREBASE_SERVICE_ACCOUNT_JSON`.
   - Imposta `VITE_TENANT_ID` = contenuto di `sandbox/TENANT_ID`.
   - **Non** aggiungere variabili `TELEGRAM_*`.
4. Fai **Deploy**.
5. Apri l’URL che ti dà Vercel: è la sandbox online.

**Importante:** sul progetto Vercel **del sito vero**, non cambiare le variabili di **Production**.

---

## D. Cose da non fare

- Non modificare `.env.local` per “passare alla sandbox” (usa solo `dev:sandbox`).
- Non usare `npm run dev` (porta 5320) quando vuoi provare in sandbox: usa **5321**.
- Non cancellare documenti in Firebase Console a mano senza sapere quale tenant è quale.

---

## Se qualcosa non parte

| Problema | Cosa fare |
|----------|-----------|
| `Manca sandbox/.env.sandbox.local` | Esegui `npm run sandbox:create` |
| Porta occupata | Chiudi altre finestre terminale con `dev:sandbox` o riavvia il PC |
| Mappa o upload non funzionano | Le chiavi sono in `sandbox/.env.sandbox.local` (generate dallo script); controlla che `sandbox:create` sia andato a buon fine |

Per aiuto tecnico, indica: messaggio di errore nel terminale e se stavi usando porta **5320** o **5321**.
