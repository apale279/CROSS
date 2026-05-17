# Guida operativa CROSS

**Versione documento:** maggio 2026  
**Prodotto:** CROSS — gestione operativa soccorso sanitario in manifestazioni ed eventi

CROSS è la centrale operativa web per coordinare eventi, missioni, mezzi e pazienti. L’equipaggio sul campo usa il **bot Telegram** per ricevere missioni, aggiornare gli stati e, se abilitato, inviare la **posizione GPS**.

---

## Indice

1. [Panoramica e requisiti](#1-panoramica-e-requisiti)
2. [Accesso all’applicazione](#2-accesso-allapplicazione)
3. [Interfaccia comune](#3-interfaccia-comune)
4. [Dashboard](#4-dashboard)
5. [Eventi](#5-eventi)
6. [Missioni](#6-missioni)
7. [Pazienti](#7-pazienti)
8. [Mezzi](#8-mezzi)
9. [Diario](#9-diario)
10. [Impostazioni](#10-impostazioni)
11. [Mappe e posizioni (stazionamento vs GPS)](#11-mappe-e-posizioni-stazionamento-vs-gps)
12. [Monitor esterni (Kiosk)](#12-monitor-esterni-kiosk)
13. [Bot Telegram](#13-bot-telegram)
14. [Sicurezza, sessioni e logout](#14-sicurezza-sessioni-e-logout)
15. [Operazioni critiche di fine evento](#15-operazioni-critiche-di-fine-evento)
16. [Glossario stati missione](#16-glossario-stati-missione)
17. [Ruoli consigliati](#17-ruoli-consigliati)

---

## 1. Panoramica e requisiti

| Componente | Descrizione |
|------------|-------------|
| **App web** | Browser moderno (Chrome, Edge, Firefox). Connessione Internet per sincronizzazione Firestore. |
| **Account** | Creati dall’amministratore in Firebase Authentication (email + password). |
| **Bot Telegram** | Opzionale ma consigliato per equipaggi; va attivato dalla Dashboard e configurato su server (webhook). |
| **Manifestazione** | Ogni ambiente (tenant) ha dati isolati: eventi, mezzi, impostazioni, utenti Telegram. |

**Pagine principali:** Dashboard · Diario · Eventi · Missioni · Pazienti · Mezzi · Impostazioni.

---

## 2. Accesso all’applicazione

### Login

1. Aprire l’URL dell’installazione CROSS (es. ambiente di produzione Vercel).
2. Schermata **Accesso operativo** con logo CROSS.
3. Inserire **email** e **password** (minimo 6 caratteri).
4. Pulsante **Entra**.

Gli account non si auto-registrano: l’amministratore li crea in **Firebase Console → Authentication**.

### Sessione web

- La sessione resta attiva sul dispositivo fino a **Logout** (menu in alto).
- Ogni login e le navigazioni principali sono registrate in Firestore (`activityLog`) e aggiornano l’ultima attività sul profilo utente.
- La centrale può vedere chi è connesso in **Impostazioni → Utenti** (sessioni web attive).

### Guida PDF

Se l’amministratore ha caricato la guida operativa, nel menu compare il pulsante **Guida** che apre il PDF in una nuova scheda.

---

## 3. Interfaccia comune

### Barra superiore

| Elemento | Funzione |
|----------|----------|
| **Logo** | Torna alla Dashboard |
| **Nome manifestazione** | Manifestazione / tenant corrente |
| **Pallino verde / rosso** | Stato connessione Firestore (dati in tempo reale) |
| **Ora** | Ultima sincronizzazione ricevuta |
| **Nome operatore** | Utente loggato (@username se configurato) |
| **Nuovo evento** | Solo in Dashboard — apre scheda nuovo evento |
| **Dashboard · Diario · Eventi · Missioni · Pazienti · Mezzi** | Navigazione |
| **Guida** | Solo se configurato — PDF guida operativa |
| **Impostazioni** | Configurazione manifestazione |
| **Reset vista** | Solo in Dashboard — ripristina layout pannelli |
| **Logout** | Esce da questo dispositivo |

### Schede modali

Eventi, missioni, mezzi e note diario si aprono spesso in **finestre modali** senza uscire dalla pagina corrente.

---

## 4. Dashboard

Postazione centrale con due viste: **Operativo** e **Mappa tattica**.

### 4.1 Barra operativa

- **Operativo / Mappa tattica** — cambia vista principale.
- **Bot Telegram — Attivo / Spento** — abilita invii missione, comandi equipaggio e webhook. Se configurato, compare il link `@[nome_bot]`.
- **Ticker note importanti** — sotto i pulsanti: scorre in loop continuo i titoli delle note diario marcate **importanti**. Clic sul titolo apre la nota. Passando il mouse lo scorrimento si ferma.

### 4.2 Vista Operativo — tre pannelli

I pannelli sono **trascinabili**, **ridimensionabili** e possono essere inviati su **monitor esterni** (vedi [§12](#12-monitor-esterni-kiosk)).

#### Eventi e missioni

- Tabella in tempo reale: eventi aperti con missioni collegate.
- Evento: tipo, dettaglio, indirizzo o luogo fisico, colore, numero pazienti.
- Missioni: ID, mezzo, stato, avanzamento stato, invio Telegram.
- Eventi senza missione evidenziati come orfani.
- Icona schermo intero per espandere l’elenco.

#### Stato mezzi

- Sigla, tipo, stato (Disponibile / Non disponibile), flag operativo.
- Indicatore **GPS** se il mezzo ha posizione reale da Telegram (tracking attivo).
- Clic sulla riga → scheda mezzo.

#### Mappa operativa

- Mappa Google: eventi (coordinate) e mezzi.
- Mezzo **in missione** con tracking GPS ON: marker sulla **posizione reale** inviata da Telegram.
- Mezzo senza missione o GPS spento: posizione da **stazionamento** (indirizzo configurato).
- Clic su marker → scheda evento o mezzo.

### 4.3 Vista Mappa tattica

Richiede **piantina** in Impostazioni → INFO LUOGO (URL immagine, es. Cloudinary).

| Area | Funzione |
|------|----------|
| **Sidebar sinistra** | Eventi con luogo fisico; trascina sulla piantina; crea evento rapido; stati rapidi missione |
| **Piantina centrale** | Posizionamento eventi e mezzi (coordinate % sulla piantina) |
| **Pila mezzi (destra)** | Mezzi non ancora sulla piantina; trascina per posizionarli. Verde = libero, rosso = in missione |

**Mezzo solamente esterno** (flag in scheda mezzo): non compare nella pila tattica.

**Mezzi sulla piantina:** non ricevono richieste GPS da Telegram (posizione già nota in struttura chiusa).

### 4.4 Allarmi SOS

Se un equipaggio invia **SOS / EMERGENZA** da Telegram:

> **ALLARME INVIATO DA [sigla mezzo]**

Popup a tutto schermo fino a **Ho preso visione**.

---

## 5. Eventi

Pagina **Eventi** — elenco e gestione.

### Creazione e scheda

- **Nuovo evento** (Dashboard o Eventi): tipo evento, dettaglio, colore (bianco / verde / giallo / rosso), indirizzo (Google Places), **luogo fisico** (testo per piantina / settore), note.
- Dalla scheda: modifica, missioni collegate, pazienti, chiusura.

### Chiusura

- Stato **chiuso** → l’evento non compare tra gli aperti.
- Chiusura automatica possibile quando tutte le missioni sono terminate con almeno una in **FINE MISSIONE**.

### Stand-down

- Tipo di chiusura dedicato (configurabile nelle eccezioni operative).

---

## 6. Missioni

Pagina **Missioni**.

### Scheda missione

| Sezione | Contenuto |
|---------|-----------|
| Intestazione | ID missione, stato, tempo nello stato |
| Note missione | Testo libero (salvataggio automatico) |
| Eccezioni operative | Dirottamento, flag-down, avaria/sinistro |
| Cronologia stati | Orologio = stato adesso; data/ora = modifica storico |
| Tratte / tappe | Passaggi operativi con data e descrizione |
| Evento collegato | Link scheda evento |
| Mezzo | Sigla e stato |
| **Invia su Telegram** | Invio manuale messaggio missione all’equipaggio del mezzo |

### Flusso stati (tipico)

`ALLERTARE` → `ALLERTATO` → `PARTITO` → `IN POSTO` → `DIRETTO H` → `ARRIVATO H` → `RIENTRO` → `FINE MISSIONE`

Stato **ANNULLATA** per chiusure eccezionali.

Aggiornamento da: centrale (Dashboard, scheda), Telegram (equipaggio), eccezioni operative.

### Eccezioni operative

1. **Dirottamento** — Annulla missione corrente; mezzo su altro evento aperto scelto dall’operatore.
2. **Flag-down (intercettazione a vista)** — Evento figlio; nuova missione **IN POSTO** sul nuovo intervento.
3. **Avaria / sinistro** — Chiude missione; mezzo **non operativo (avaria/sinistro)**.

### Notifiche Telegram

- Invio manuale con **Invia su Telegram**.
- Dopo cambio stato dalla centrale può partire notifica automatica con pulsante avanzamento (se bot attivo).

---

## 7. Pazienti

Pagina **Pazienti** — anagrafica e stato sanitario.

- Collegamento a **evento** e **mezzo**.
- **Esito** (Trasporta, Non trasporta, Rifiuto trasporto, …) e **stato** (ATTESA, TRASPORTO, ARRIVATO H).
- Scheda con dati clinici operativi secondo configurazione.

Con missione in **ARRIVATO H**, i pazienti in trasporto sullo stesso evento/mezzo possono aggiornarsi automaticamente.

---

## 8. Mezzi

Pagina **Mezzi** — parco mezzi.

### Scheda mezzo

| Campo | Descrizione |
|-------|-------------|
| Sigla, tipo, targa, radio | Identificazione |
| Stato mezzo | **Disponibile** / **Non disponibile** |
| Operativo | Sì / No |
| Stazionamento | Indirizzo e coordinate per mappa (pagina Mezzi / centrale) |
| Posizione tattica | Coordinate % sulla piantina + dettaglio |
| **Posizione reale mezzo** | Ultima posizione GPS da Telegram (se tracking attivo) |
| Equipaggio | Autista, medico, soccorritori |
| Mezzo solamente esterno | Escluso dalla pila mezzi in mappa tattica |
| Rimuovi dalla piantina | Azzera coordinate % sulla piantina |

### Creazione

- Sigla univoca (senza spazi), tipo, stazionamento, equipaggio.

---

## 9. Diario

Note operative condivise.

| Funzione | Descrizione |
|----------|-------------|
| Aggiungi nota | Titolo, testo, flag **importante** |
| Stato | Aperta / Chiusa |
| Importante | Evidenziata; compare nel **ticker** Dashboard |
| Modifica / Elimina | Da tabella o modale |
| **Invia a tutti** | Nella visualizzazione nota: invia il testo a tutti gli equipaggi Telegram **loggati** (mezzo assegnato, sessione valida) |

Il ticker in Dashboard mostra solo le note **importanti** in scorrimento continuo.

---

## 10. Impostazioni

Sei schede.

### 10.1 Impostazioni eventi

- Tipi evento e dettagli per tipo
- Colori evento
- Stati missione (ordine del flusso)
- Opzioni collegate agli eventi

### 10.2 INFO LUOGO

- **URL piantina** — immagine per mappa tattica (Cloudinary, URL pubblico, …)
- **Luogo fisico** predefinito per nuovi eventi

### 10.3 Mezzi e strutture

- Tipi mezzo
- Lista ospedali
- Stazionamenti predefiniti
- Centro mappa dashboard (se nessun evento ha coordinate)
- Registro partecipanti (import Excel)
- **Zona pericolosa** — elimina tutti eventi, missioni e mezzi (irreversibile)

### 10.4 Utenti

- **Utenti web attivi** — operatori con sessione non revocata (nome, username, email, ultima attività, pagina corrente)
- Per equipaggio Telegram → scheda **Telegram**

### 10.5 Telegram

| Strumento | Uso |
|-----------|-----|
| **TRACKING GPS** | ON: equipaggio può inviare GPS; mappa operativa usa posizione reale in missione. OFF: azzera posizioni GPS salvate; solo stazionamento |
| **Equipaggio loggato (bot)** | Elenco mezzi assegnati su Telegram; destinatari di «Invia a tutti» dal diario |
| **Password bot** | Password prima della scelta mezzo. Al cambio: tutti disconnessi → `/cambiapassword` e `/start` |
| **Forza logout** | Disconnette tutti i Telegram dai mezzi (messaggi restano sui telefoni) |
| **Logout globale e pulizia** | Fine manifestazione: cancella messaggi missione, resetta chat bot, doppia conferma. **Non** slogga l’app web |

Il bot deve essere **Attivo** in Dashboard per invii e comandi.

### 10.6 Guida

- Carica **PDF** su Cloudinary (pulsante o URL manuale)
- Salvataggio in `guida_pdf_url` — abilita link **Guida** nel menu

**Caricamento da terminale (amministratore):**

```bash
node --env-file=.env.local scripts/upload-guida-pdf.mjs
# oppure
npm run upload:guida-pdf
```

Richiede `CLOUDINARY_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `TELEGRAM_TENANT_ID` (o `VITE_TENANT_ID`). File predefinito: `GUIDA.pdf` nella root del progetto.

---

## 11. Mappe e posizioni (stazionamento vs GPS)

CROSS distingue tre concetti — **non si sovrascrivono**:

| Campo | Origine | Uso |
|-------|---------|-----|
| `stazionamento.coordinate` | Pagina Mezzi / centrale | Mappa quando il mezzo **non** è in missione attiva, o GPS spento |
| `coordinate_stazionamento` | Mappa tattica (% sulla piantina) | Posizione in struttura chiusa; **nessuna richiesta GPS** Telegram |
| `posizioneReale` | Solo Telegram (GPS) | Mappa operativa quando il mezzo è **in missione** e tracking ON |

### Regole mappa operativa

- **In missione** + tracking GPS ON + posizione ricevuta → marker GPS reale.
- **In missione** ma senza GPS → stazionamento.
- **Senza missione** → sempre stazionamento.
- **Tracking GPS OFF** (Impostazioni) → mai posizione reale; eventuale pulizia massiva delle coordinate GPS.

### Equipaggio Telegram

- Dopo scelta mezzo (se mezzo **non** in piantina): richiesta consenso GPS.
- Dopo avanzamento stato: può inviare posizione (tasto o live location).
- Comando **`/gps`** — gestione consenso e invio posizione.

---

## 12. Monitor esterni (Kiosk)

Per postazioni multi-schermo dalla Dashboard:

1. Su ogni pannello (Eventi/missioni, Mezzi, Mappa) usare il pulsante **apri su monitor esterno** (pop-out).
2. Si apre una finestra dedicata (`/kiosk/eventi`, `/kiosk/mezzi`, `/kiosk/mappa`).
3. Se la finestra viene chiusa, il pannello torna come **icona** nella barra dock in Dashboard — clic per ripristinare.
4. **Reset vista** ripristina anche i pannelli kiosk.

Utile per: tabellone eventi su un monitor, mappa su un altro, stato mezzi su un terzo.

---

## 13. Bot Telegram

### 13.1 Prerequisiti (amministratore)

1. Bot creato con [@BotFather](https://t.me/BotFather).
2. Variabili server: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TENANT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, opzionale `TELEGRAM_WEBHOOK_SECRET`.
3. Webhook: `https://[dominio]/api/telegram-webhook` (script `scripts/register-telegram-webhook.mjs`).
4. In CROSS: bot **Attivo** + password (se richiesta) in Impostazioni.
5. Opzionale: `VITE_TELEGRAM_BOT_USERNAME` per link al bot in app.

### 13.2 Primo accesso equipaggio

1. Aprire il bot (link Dashboard o `@nome_bot`).
2. Se richiesta: inviare **password** (testo, non comando).
3. **`/start`** — scegliere **mezzo** dai pulsanti.
4. Se GPS attivo e mezzo **esterno**: consenso condivisione posizione.
5. Tastiera: **SOS / EMERGENZA**, **/stato**, **/gps**, **/start**.

### 13.3 Comandi

| Comando / azione | Effetto |
|------------------|---------|
| `/start` | Nuova scelta mezzo (dopo password se attiva) |
| Password (testo) | Solo se richiesta dalla sessione |
| `/cambiapassword` | Dopo cambio password centrale |
| `/stato` | Missioni aperte del mezzo; pulsanti avanzamento stato |
| `/gps` | Gestione consenso e invio posizione GPS |
| **SOS / EMERGENZA** | Allarme centrale + popup Dashboard |
| Pulsante sotto messaggio missione | Avanza allo stato successivo |
| Pulsanti inline mezzo | Registra Telegram su quella sigla |
| **Invia posizione GPS** | Aggiorna posizione reale su Firestore |

### 13.4 Flusso missione

1. Centrale crea/aggiorna missione → **Invia su Telegram** (o notifica automatica su cambio stato).
2. Equipaggio del mezzo corretto riceve messaggio HTML.
3. Pulsante sotto il messaggio per stato successivo (se missione aperta).
4. Aggiornamenti visibili in tempo reale in Dashboard.

Solo i dispositivi registrati sul **mezzo corretto** ricevono i messaggi di quella missione.

### 13.5 Casi particolari

- **ANNULLATA** — notifica senza pulsanti attivi.
- **Più missioni aperte** — `/stato` mostra elenco scelta.
- **Mezzo in piantina** — nessun GPS richiesto.
- **Tracking OFF** — messaggio informativo; solo stazionamento in mappa.

### 13.6 Risoluzione problemi

| Problema | Soluzione |
|----------|-----------|
| Non ricevo missioni | Bot **Attivo**, `/start` + mezzo corretto, stesso tenant |
| Password rifiutata | Password aggiornata; `/cambiapassword` |
| Pulsanti inattivi | Missione chiusa/annullata; `/stato` |
| Bot muto | Bot spento o webhook errato (`scripts/check-telegram-webhook.mjs`) |
| GPS non aggiorna | Tracking ON in Impostazioni; mezzo non in piantina; consenso `/gps` |
| Fine evento | **Forza logout** o **Logout globale e pulizia** |

---

## 14. Sicurezza, sessioni e logout

### Sessione web (operatori)

- Ogni login genera `active_session_token` sul profilo.
- **Logout globale** amministrativo (se previsto nel flusso) può revocare sessioni remote.
- Elenco sessioni attive: **Impostazioni → Utenti**.

### Sessione Telegram (equipaggio)

- Associazione `chatId` ↔ mezzo in Firestore.
- **Forza logout** — solo disassociazione, messaggi restano.
- **Logout globale e pulizia** — wipe messaggi bot + reset utenti Telegram.

### Registro attività

- Login, logout, navigazione (`PAGE_VIEW`) in `activityLog`.
- Ultima pagina e orario visibili in elenco utenti attivi.

---

## 15. Operazioni critiche di fine evento

| Azione | Dove | Effetto |
|--------|------|---------|
| Fine turno equipaggio | Impostazioni → Telegram → **Forza logout** | Telegram disconnessi dai mezzi; rifare `/start` |
| Fine manifestazione | **Logout globale e pulizia** | Messaggi missione cancellati, chat avvisate, reset bot |
| Reset layout | Dashboard → **Reset vista** | Solo posizione pannelli |
| Reset totale dati | Impostazioni → **Zona pericolosa** | Cancella eventi, missioni, mezzi |

---

## 16. Glossario stati missione

| Stato | Significato tipico |
|-------|-------------------|
| **ALLERTARE** | Missione creata, mezzo da allertare |
| **ALLERTATO** | Equipaggio informato |
| **PARTITO** | In viaggio verso l’evento |
| **IN POSTO** | Sul luogo |
| **DIRETTO H** | Trasporto verso ospedale |
| **ARRIVATO H** | Arrivo in ospedale |
| **RIENTRO** | Rientro dopo consegna |
| **FINE MISSIONE** | Conclusa normalmente |
| **ANNULLATA** | Chiusa per eccezione |

---

## 17. Ruoli consigliati

| Ruolo | Strumenti principali |
|-------|----------------------|
| **Centrale operativa** | Dashboard, Eventi, Missioni, Diario, invio Telegram |
| **Coordinatore** | Mappa tattica, eventi rapidi, monitor kiosk |
| **Equipaggio campo** | Bot: `/start`, `/stato`, `/gps`, SOS |
| **Amministratore** | Impostazioni complete, password bot, GPS, guida PDF, utenti attivi, pulizia Telegram |

---

*Documento CROSS — aggiornato alle funzionalità in produzione (web + Telegram + GPS + guida PDF + utenti attivi + kiosk). Per dettagli tecnici di deploy vedere README e `.env.example` nel repository.*
