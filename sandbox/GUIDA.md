# Guida sandbox — passo passo (senza programmare)

Hai **due protezioni** separate:

1. **Branch Git `sandbox`** — codice di prova in Cursor, senza toccare `main` (ufficiale).
2. **Tenant Firebase sandbox** — dati di prova (eventi/missioni vuoti), senza toccare la produzione.

| | Codice (Cursor) | Dati (Firebase) |
|---|-----------------|-----------------|
| Ufficiale | branch **`main`** | tenant produzione |
| Prove | branch **`sandbox`** | tenant in `sandbox/TENANT_ID` |

| | Sito vero in locale | Sandbox in locale |
|---|---------------------|-------------------|
| Branch | `main` | `sandbox` |
| Comando | `npm run dev` → **5320** | `npm run dev:sandbox` → **5321** |
| Telegram | sì (se configurato) | **spento** |

---

## 0. Branch in Cursor (codice) — leggi prima di lavorare

### Come capire dove sei

In basso a sinistra in Cursor c’è il nome del branch (es. `main` o `sandbox`).

- **`sandbox`** → puoi modificare file e provare funzioni.
- **`main`** → codice ufficiale: evita modifiche se stai solo sperimentando.

### Passare al branch sandbox (per provare)

**Metodo facile (clic):**

1. Clic sul nome del branch in basso a sinistra (`main` o altro).
2. Nella lista scegli **`sandbox`**.
3. Attendi qualche secondo: Cursor cambia i file alla versione sandbox.

**Metodo terminale:**

```text
git checkout sandbox
```

### Tornare al codice ufficiale

1. Clic sul branch in basso a sinistra.
2. Scegli **`main`**.

Oppure nel terminale:

```text
git checkout main
```

### Regola d’oro

- Nuove funzioni, test, modifiche ai file → resta su **`sandbox`**.
- Solo quando sei sicuro → si può unire in `main` (meglio farlo insieme a chi segue il progetto).

**ID tenant dati:** file `sandbox/TENANT_ID`.

---

## A. Aprire la sandbox sul tuo PC (ogni volta che vuoi provare)

### Passo 0 — Sei sul branch giusto?

Controlla in basso a sinistra: deve esserci **`sandbox`**.  
Se vedi `main`, segui la sezione **0** sopra.

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

Aspetta finché compare:

```text
Local:   http://localhost:5321/
```

**Non chiudere** quella finestra mentre usi la sandbox.

Vedrai il badge **Sandbox** accanto al logo (header) e sulla **home** (barra Operativo / Mappa tattica). Non c’è più il banner giallo fisso in alto.

**Login admin sandbox** (dopo `npm run sandbox:admin`):

- Email: `admin.sandbox@admin.it`
- Password: `admin.sandbox`

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

**Un solo repository GitHub** (`apale279/CROSS`). Due progetti Vercel (prod + `cross_sandbox`).

### C.1 Variabili (progetto cross_sandbox)

**Settings → Environment Variables** (Production, Preview, Development):

| Variabile | Valore |
|-----------|--------|
| `VITE_TENANT_ID` | contenuto di `sandbox/TENANT_ID` |
| `VITE_APP_SANDBOX` | `true` |
| `VITE_PRODUCTION_TENANT_ID` | ID tenant del sito vero (produzione) |
| Firebase, Maps, Cloudinary | come produzione |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | come produzione |

**Non** impostare: `TELEGRAM_*`, `VITE_API_BASE_URL` verso il sito di produzione.

Dopo ogni modifica env: **Deployments → Redeploy**.

### C.2 Branch deploy (non è in “Git”)

**Settings → Environments → Production** → **Branch Tracking** → branch **`sandbox`** → Save.

(Passato si chiamava “Production Branch” sotto Git; ora è qui.)

### C.3 Deploy che mostra ancora `main` come Source

Normale se il deploy è **vecchio** (fatto prima del cambio branch). Controlla:

1. **Deployments** → ultimo deploy → **Source** deve essere **`sandbox`** e commit recente.
2. Se è ancora `main`: **Create Deployment** con branch `sandbox`, oppure push su `sandbox` e attendi, oppure **Redeploy** dopo Save su Environments.

In basso alla pagina deploy può comparire: *“push to the sandbox branch”* — significa che la **prossima** produzione userà `sandbox`.

### C.4 URL

Apri il dominio del progetto sandbox (es. `crosssandbox.vercel.app`), non quello del sito vero.

**Importante:** sul progetto Vercel **del sito vero**, lascia Production su branch **`main`** e `VITE_TENANT_ID` di produzione.

---

## D. Creare utenti operatori (come in produzione)

Stesso flusso dell’app originale: **Impostazioni → tab Utenti → Account operatori**.

1. Accedi con un account **Centrale** che possa modificare le impostazioni (es. creato con `npm run sandbox:admin` → `admin.sandbox@admin.it` / `admin.sandbox`).
2. **Nuovo utente**: email, password, nome, tipo accesso **PMA** o **Centrale**.
3. Per operatori tenda: **PMA** + **Rank** (Medico, Infermiere, Soccorritore, Triage) + **PMA assegnato** (stesse opzioni della produzione).
4. Le API `/api/admin-users` scrivono solo sul tenant sandbox (`VITE_TENANT_ID` del deploy sandbox); il tenant produzione è bloccato se `VITE_APP_SANDBOX=true` e `VITE_PRODUCTION_TENANT_ID` sono configurati.

Primo admin sandbox da terminale (una tantum):

```bash
npm run sandbox:admin
```

---

## E. Cose da non fare

- Non modificare file importanti stando su **`main`** se stai solo provando → usa **`sandbox`**.
- Non modificare `.env.local` per “passare alla sandbox” (usa `dev:sandbox` e branch `sandbox`).
- Non usare `npm run dev` (5320) quando vuoi la sandbox dati: usa **5321** su branch **sandbox**.
- Non cancellare documenti in Firebase Console senza sapere quale tenant è quale.

---

## F. Se qualcosa non parte

| Problema | Cosa fare |
|----------|-----------|
| `Manca sandbox/.env.sandbox.local` | Esegui `npm run sandbox:create` |
| Porta occupata | Chiudi altre finestre terminale con `dev:sandbox` o riavvia il PC |
| Mappa o upload non funzionano | Le chiavi sono in `sandbox/.env.sandbox.local` (generate dallo script); controlla che `sandbox:create` sia andato a buon fine |
| Vedo ancora il banner giallo in alto | Deploy vecchio: Redeploy da branch `sandbox` con `VITE_APP_SANDBOX=true` |
| Vedo gli stessi eventi della produzione | `VITE_TENANT_ID` sbagliato sul progetto Vercel sandbox — usa `sandbox/TENANT_ID` |

Per aiuto tecnico, indica: messaggio di errore nel terminale e se stavi usando porta **5320** o **5321**.
