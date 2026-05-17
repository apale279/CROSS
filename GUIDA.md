# Guida CROSS — Applicazione e Bot Telegram

CROSS è il sistema di gestione operativa per soccorso sanitario in manifestazioni ed eventi. La centrale lavora da browser; l’equipaggio sul campo può ricevere missioni e aggiornare gli stati tramite **Bot Telegram**.

---

## Indice

1. [Accesso all’applicazione](#1-accesso-allapplicazione)
2. [Interfaccia comune](#2-interfaccia-comune)
3. [Dashboard](#3-dashboard)
4. [Eventi](#4-eventi)
5. [Missioni](#5-missioni)
6. [Pazienti](#6-pazienti)
7. [Mezzi](#7-mezzi)
8. [Diario](#8-diario)
9. [Impostazioni](#9-impostazioni)
10. [Bot Telegram — guida completa](#10-bot-telegram--guida-completa)
11. [Chiusura evento e operazioni critiche](#11-chiusura-evento-e-operazioni-critiche)
12. [Glossario stati missione](#12-glossario-stati-missione)

---

## 1. Accesso all’applicazione

### Login e registrazione

- All’avvio compare la schermata **Accesso operativo** con il logo CROSS.
- **Accedi**: nome utente e password (minimo 6 caratteri).
- **Nuovo utente**: nome visualizzato, nome utente univoco per la manifestazione, password e conferma.

Ogni accesso e le navigazioni principali vengono registrate in Firestore (`activityLog`).

### Sessione

- La sessione resta attiva sul dispositivo fino al **Logout** (menu in alto a destra).
- In caso di **logout globale Telegram** o revoca sessione da amministrazione, gli operatori web restano connessi; solo il bot viene resettato (vedi [§10.5](#105-chiusura-evento-e-pulizia-telegram)).

---

## 2. Interfaccia comune

### Barra superiore

| Elemento | Funzione |
|----------|----------|
| **Logo** | Torna alla Dashboard |
| **Nome manifestazione** | Evento/manifestazione corrente |
| **Pallino verde/rosso** | Connessione Firestore (sincronizzazione dati) |
| **Ora sincronizzazione** | Ultimo aggiornamento ricevuto da Firestore |
| **Nuovo evento** | Visibile solo in Dashboard — apre la scheda nuovo evento |
| **Dashboard / Diario / Eventi / Missioni / Pazienti / Mezzi / Impostazioni** | Navigazione principale |
| **Reset vista** | Solo in Dashboard — ripristina posizione e dimensioni dei pannelli flottanti |
| **Logout** | Esce dall’account su questo dispositivo |

### Schede modali

Molte entità (evento, missione, mezzo) si aprono in **finestre modali** sovrapposte alla pagina corrente, senza perdere il contesto della lista.

---

## 3. Dashboard

La Dashboard è la postazione centrale. Due viste, selezionabili dal riquadro in alto.

### 3.1 Barra operativa (in alto)

- **Operativo** / **Mappa tattica**: cambia vista.
- **Bot Telegram**: interruttore **Attivo / Spento** per abilitare invii e webhook. Se configurato, compare il link `@[nome_bot]`.
- **Ticker note importanti** (sotto i pulsanti): testo scorrevole con le note del **Diario** marcate come importanti. Clic su un titolo apre la nota. Passando il mouse lo scorrimento si ferma.

### 3.2 Vista Operativo

Tre **pannelli flottanti** (trascinabili e ridimensionabili):

#### Eventi e missioni

- Tabella in tempo reale: eventi aperti con le missioni collegate.
- Colonna evento: tipo, dettaglio, indirizzo o **luogo fisico**, colore, numero pazienti.
- Colonna missioni: ID missione, mezzo, stato, pulsante avanzamento stato, invio Telegram.
- Eventi **senza missione** evidenziati come orfani.
- Icona **schermo intero** per espandere l’elenco.

#### Stato mezzi

- Elenco mezzi con sigla, tipo, stato (Disponibile / Non disponibile / altri), flag operativo.
- Clic sulla riga → **scheda mezzo**.

#### Mappa

- Mappa Google con eventi (coordinate) e mezzi.
- Clic su marker → scheda evento o mezzo.

### 3.3 Vista Mappa tattica

Richiede **piantina** configurata in Impostazioni → INFO LUOGO.

| Area | Funzione |
|------|----------|
| **Sidebar sinistra** | Eventi con luogo fisico; drag sulla piantina; **Crea evento rapido**; pulsanti stato rapido per missione |
| **Piantina centrale** | Posizionamento eventi e mezzi (coordinate % sulla mappa) |
| **Pila mezzi (destra)** | Mezzi non ancora sulla piantina; trascina per posizionarli. Verde = libero, rosso = in missione attiva |

**Mezzo solamente esterno** (flag in scheda mezzo): non compare nella pila tattica.

### 3.4 Allarmi SOS

Se un equipaggio invia **SOS** da Telegram, compare un popup a tutto schermo:

> **ALLARME INVIATO DA [sigla mezzo]**

Confermare con **Ho preso visione** per archiviare l’allarme.

---

## 4. Eventi

Pagina **Eventi** — elenco e gestione completa.

### Creazione e scheda evento

- **Nuovo evento** (Dashboard o pagina Eventi): tipo, dettaglio, colore (bianco/verde/giallo/rosso), indirizzo (Google Places), **luogo fisico** (testo libero per piantina/settore), note.
- Dalla scheda: modifica campi, collegamento **missioni** e **pazienti**, chiusura evento.

### Chiusura evento

- Impostando lo stato evento su **chiuso**, l’evento non compare più tra gli aperti.
- Chiusura automatica possibile quando tutte le missioni sono terminate con almeno una in **FINE MISSIONE** (logica automatica in scheda).

### Stand-down

- Tipo di chiusura dedicato per stand-down (configurabile nelle eccezioni operative).

---

## 5. Missioni

Pagina **Missioni** — tutte le missioni della manifestazione.

### Scheda missione

| Sezione | Contenuto |
|---------|-----------|
| **Intestazione** | ID missione, stato attuale, tempo nello stato |
| **Note missione** | Testo libero, salvataggio su blur |
| **Eccezioni operative** | Sezione collassabile (apri solo se serve) — vedi sotto |
| **Cronologia stati** | Orologio = imposta stato **adesso**; campo data/ora = modifica storico |
| **Tratte / tappe** | Passaggi operativi (es. rifornimento) con data e descrizione |
| **Evento collegato** | Link per aprire scheda evento |
| **Mezzo** | Sigla e stato mezzo |
| **Invia su Telegram** | Invio manuale messaggio missione all’equipaggio del mezzo |

### Stati missione

Flusso tipico (configurabile in Impostazioni):

`ALLERTARE` → `ALLERTATO` → `PARTITO` → `IN POSTO` → `DIRETTO H` → `ARRIVATO H` → `RIENTRO` → `FINE MISSIONE`

Stato speciale **ANNULLATA** (missione chiusa senza completamento normale).

Dalla centrale: icona orologio nella cronologia, pulsante avanzamento in tabella Dashboard, o aggiornamento da Telegram (equipaggio).

### Eccezioni operative (scheda missione)

1. **Dirottamento** — Annulla la missione corrente; il mezzo passa a un altro evento aperto scelto dall’operatore.
2. **Flag-down (intercettazione a vista)** — Crea evento figlio collegato; annulla missione precedente; apre nuova missione **IN POSTO** sul nuovo intervento.
3. **Avaria / sinistro** — Chiude missione; evento resta aperto; mezzo segnato **non operativo (avaria/sinistro)**.

### Invio Telegram

- Pulsante **Invia su Telegram** sulla missione (se bot attivo e mezzo assegnato su Telegram).
- Dopo cambio stato dalla centrale, viene inviata automaticamente una notifica Telegram con il nuovo stato (e pulsante avanzamento se previsto).

---

## 6. Pazienti

Pagina **Pazienti** — anagrafica e stato sanitario collegati agli eventi.

- Collegamento a **evento** e **mezzo**.
- **Esito** (es. Trasporta, Non trasporta, …) e **stato** (ATTESA, TRASPORTO, ARRIVATO H).
- Scheda paziente con valutazioni e dati clinici operativi (secondo configurazione manifestazione).

Quando una missione passa ad **ARRIVATO H**, i pazienti in trasporto sullo stesso evento/mezzo possono essere aggiornati automaticamente.

---

## 7. Mezzi

Pagina **Mezzi** — parco mezzi e equipaggi.

### Scheda mezzo (Dashboard o pagina Mezzi)

| Campo | Descrizione |
|-------|-------------|
| Sigla, tipo, targa, radio | Identificazione |
| **Stato mezzo** | Due pulsanti: **Disponibile** / **Non disponibile** |
| **Operativo** | Sì/No (mezzo fuori servizio) |
| **Posizione tattica** | Se sulla piantina: coordinate % e dettaglio stazionamento |
| **Equipaggio** | Autista, medico, soccorritori |
| **Mezzo solamente esterno** | Se attivo: escluso dalla pila mezzi in mappa tattica |
| **Rimuovi dalla piantina** | Azzera posizione sulla piantina |

### Creazione mezzo

- Sigla univoca (senza spazi), tipo, stazionamento, equipaggio, ecc.

---

## 8. Diario

Pagina **Diario** — note operative condivise.

| Funzione | Descrizione |
|----------|-------------|
| **Aggiungi nota** | Titolo + testo + flag **importante** |
| **Stato** | Aperta / Chiusa |
| **Importante** | Evidenziata in giallo; compare nel **ticker** della Dashboard |
| **Modifica / Elimina** | Da tabella o modale |

Le note importanti scorrono in Dashboard; clic apre il dettaglio.

---

## 9. Impostazioni

Accesso: menu **Impostazioni**. Quattro schede.

### 9.1 Impostazioni eventi

- Tipi evento e dettagli per tipo
- Colori evento
- Stati missione (ordine del flusso)
- Altre opzioni collegate agli eventi

### 9.2 INFO LUOGO

- **URL piantina** (immagine ospitata, es. Cloudinary) per mappa tattica
- **Luogo fisico** predefinito (testo suggerito per nuovi eventi)

### 9.3 Mezzi e strutture

- Tipi mezzo
- Lista ospedali
- Stazionamenti predefiniti
- Centro mappa dashboard (se nessun evento ha coordinate)
- Registro partecipanti (import Excel)
- **Zona pericolosa**: elimina tutti eventi, missioni e mezzi (irreversibile)

### 9.4 Telegram

| Strumento | Uso |
|-----------|-----|
| **Password bot** | Password richiesta all’equipaggio prima di scegliere il mezzo. Al cambio password tutti vengono disconnessi e devono usare `/cambiapassword` poi `/start` |
| **Forza logout** | Fine turno: disconnette tutti gli utenti Telegram dai mezzi (non cancella messaggi, non slogga l’app web) |
| **Logout globale e pulizia** | Fine evento/manifestazione: cancella messaggi missione sui telefoni, resetta associazioni bot, invia messaggio di chiusura alle chat. **Doppia conferma**. Non disconnette gli operatori dall’app web |

Il bot deve essere **Attivo** dalla Dashboard per invii e comandi.

---

## 10. Bot Telegram — guida completa

### 10.1 Prerequisiti (amministratore)

1. Bot creato con [@BotFather](https://t.me/BotFather).
2. Variabili su Vercel: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_TENANT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON`, opzionale `TELEGRAM_WEBHOOK_SECRET`.
3. Webhook Telegram puntato all’URL `https://[tuo-dominio]/api/telegram-webhook`.
4. In CROSS: bot **Attivo** + password impostata in Impostazioni → Telegram.
5. Variabile client opzionale `VITE_TELEGRAM_BOT_USERNAME` per mostrare il link al bot nell’app.

### 10.2 Primo accesso equipaggio

1. Aprire il bot su Telegram (link dalla Dashboard o cercare `@nome_bot`).
2. Se richiesta **password**: inviare la password configurata dalla centrale (testo semplice, non un comando).
3. Inviare **`/start`**.
4. Scegliere il **mezzo** dai pulsanti inline (sigle configurate in CROSS).
5. Compare la tastiera persistente:
   - **SOS / EMERGENZA**
   - **/stato**
   - **/start**

### 10.3 Comandi Telegram

| Comando / azione | Chi lo usa | Effetto |
|------------------|------------|---------|
| **`/start`** | Equipaggio | Nuova scelta mezzo (dopo password se attiva). Resetta il mezzo corrente e mostra l’elenco sigle |
| **Password** (testo) | Equipaggio | Solo se il bot richiede password e la sessione è in attesa |
| **`/cambiapassword`** | Equipaggio | Dopo che la centrale ha cambiato password: termina sessione e chiede la nuova password, poi `/start` |
| **`/stato`** | Equipaggio | Mostra missioni aperte del proprio mezzo; consente di avanzare lo stato con pulsanti |
| **SOS / EMERGENZA** (tasto o testo) | Equipaggio | Allarme immediato alla centrale + conferma sul telefono. Popup in app: **ALLARME INVIATO DA [sigla]** |
| **Pulsante sotto messaggio missione** | Equipaggio | Avanza allo stato successivo previsto (es. da ALLERTATO a PARTITO) |
| **Selezione mezzo** (pulsanti inline) | Equipaggio | Registra il dispositivo Telegram su quella sigla |

### 10.4 Flusso missione su Telegram

1. La centrale crea/aggiorna una missione e preme **Invia su Telegram** (o lo stato viene notificato dopo un cambio dalla centrale).
2. L’equipaggio del **mezzo assegnato** riceve un messaggio HTML con dati missione/evento.
3. Sotto il messaggio può comparire un pulsante per passare allo **stato successivo** (se la missione non è chiusa).
4. Ogni avanzamento aggiorna Firestore; la centrale vede il cambio in tempo reale su Dashboard.

**Nota:** Solo i dispositivi Telegram registrati sul **mezzo corretto** ricevono i messaggi di quella missione.

### 10.5 Missione annullata dalla centrale

Se la centrale imposta **ANNULLATA**, l’equipaggio riceve notifica senza pulsanti attivi; i vecchi pulsanti su messaggi precedenti non sono più validi.

### 10.6 Più missioni aperte

Con più missioni sullo stesso mezzo, `/stato` mostra prima un elenco per scegliere quale missione aggiornare.

### 10.7 Cosa fa la centrale con il bot

| Azione centrale (app web) | Effetto su Telegram |
|---------------------------|-------------------|
| Attiva/disattiva bot | Blocca o abilita invii e comandi |
| Invia missione | Messaggio ai chat registrati sul mezzo |
| Cambia stato missione | Notifica automatica (se implementata nel flusso) |
| SOS ricevuto | Popup allarme in Dashboard |
| Forza logout | Tutti devono rifare `/start` e scegliere mezzo |
| Logout globale e pulizia | Messaggi missione cancellati dai telefoni; chat ricevono avviso di sessione conclusa; tutti i legami mezzo vengono azzerati |

### 10.8 Risoluzione problemi Telegram

| Problema | Soluzione |
|----------|-----------|
| Non ricevo missioni | Verificare bot **Attivo**, mezzo scelto con `/start`, stessa manifestazione (tenant) |
| Password non accettata | Chiedere alla centrale la password aggiornata; provare `/cambiapassword` |
| Pulsanti non funzionano | Missione chiusa o annullata; usare `/stato` per messaggio aggiornato |
| Bot non risponde | Bot spento in Dashboard o webhook non configurato |
| Dopo fine evento | Centrale esegue **Forza logout** o **Logout globale e pulizia** |

---

## 11. Chiusura evento e operazioni critiche

### Fine turno equipaggio (solo Telegram)

**Impostazioni → Telegram → Forza logout**

- Disconnette tutti i Telegram dai mezzi.
- L’equipaggio deve rifare `/start` (e password se richiesta).
- I messaggi restano sul telefono.

### Fine manifestazione / pulizia completa Telegram

**Impostazioni → Telegram → Logout globale e pulizia**

- Richiede **doppia conferma**.
- Cancella i messaggi missione inviati dal bot (nei limiti API Telegram).
- Invia un messaggio finale alle chat coinvolte.
- Svuota le registrazioni `telegram_users`.
- **Non** disconnette gli account dell’app web.

### Reset layout Dashboard

**Reset vista** nel menu — ripristina solo posizione/dimensione pannelli, non cancella dati operativi.

### Zona pericolosa

**Impostazioni → Mezzi e strutture** (in fondo) — elimina **tutti** eventi, missioni e mezzi. Solo per ambienti di test o reset totale.

---

## 12. Glossario stati missione

| Stato | Significato operativo tipico |
|-------|------------------------------|
| **ALLERTARE** | Missione creata, mezzo da allertare |
| **ALLERTATO** | Equipaggio informato |
| **PARTITO** | Mezzo in viaggio verso l’evento |
| **IN POSTO** | Mezzo sul luogo |
| **DIRETTO H** | Trasporto verso ospedale/struttura |
| **ARRIVATO H** | Arrivo in ospedale |
| **RIENTRO** | Rientro dopo consegna |
| **FINE MISSIONE** | Missione conclusa normalmente |
| **ANNULLATA** | Missione chiusa per eccezione (dirottamento, flag-down, ecc.) |

---

## Ruoli consigliati

| Ruolo | Strumenti principali |
|-------|----------------------|
| **Centrale operativa** | Dashboard, Eventi, Missioni, Diario, Impostazioni (limitate), invio Telegram |
| **Coordinatore** | Mappa tattica, creazione eventi rapidi, gestione mezzi sulla piantina |
| **Equipaggio campo** | Bot Telegram: `/start`, `/stato`, SOS |
| **Amministratore** | Impostazioni complete, password bot, logout/pulizia Telegram |

---

*Documento generato per il progetto CROSS. Per aggiornamenti funzionali fare riferimento al codice e alle impostazioni della manifestazione attiva.*
