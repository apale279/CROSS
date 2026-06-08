# CROSS — Checklist test manuale MAIN-V5

**Branch:** `main-v5`  
**Ultimo commit di riferimento:** `bf72a01`  
**Data test:** _______________  
**Tester:** _______________  
**Ambiente:** ☐ Locale (`localhost`) ☐ LAN (`192.168.x.x`) ☐ Produzione/Vercel  

**Legenda:** ☐ = da fare · ✅ = OK · ❌ = KO · ⏭ = saltato · Note in fondo a ogni sezione

---

## Riepilogo rapido

| Area | OK | KO | Saltati |
|------|----|----|---------|
| 1. Dimissione PMA | | | |
| 2. Cartella clinica multi-op | | | |
| 3. Creazione paziente / MSB-MSA | | | |
| 4. Auth / Popup kiosk | | | |
| 5. Auto-close evento | | | |
| 6. Eventi / Missioni / Mezzi | | | |
| 7. Codici colore paziente ↔ mezzo | | | |
| 8. Impostazioni granulari | | | |
| 9. Pazienti / sync / codice minore | | | |
| 10. GPS / posizione mezzo | | | |
| 11. Telegram | | | |
| 12. Wipe dati | | | |
| 13. UI Dashboard | | | |
| **Flusso end-to-end** | | | |

---

## 1. PMA — Dimissione

**File coinvolti:** `dimissioneValidate.ts`, `dimissionePatchGuard.ts`, `DimissioneSection.tsx`, `pazientePmaPatch.js`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 1.1 | Dimetti paziente **senza** note dimissione (es. incosciente) → solo esito + medico richiesti | ☐ | ☐ | |
| 1.2 | Dimetti paziente **senza** firma paziente | ☐ | ☐ | |
| 1.3 | Esito **Invio PS** senza ospedale in scheda PMA → dimissione consentita | ☐ | ☐ | |
| 1.4 | Campo **Email paziente** visibile sotto le note | ☐ | ☐ | |
| 1.5 | Pulsante **Invia via mail** → apre client posta (`mailto:`) | ☐ | ☐ | PDF non allegato via mailto (atteso) |
| 1.6 | Dopo dimissione, riapri scheda: campi opzionali ancora coerenti | ☐ | ☐ | |

**Note sezione 1:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 2. PMA — Cartella clinica multi-operatore (v5 — CRITICO)

**File coinvolti:** `PmaFieldPresenceContext.tsx`, `pazientePmaPatch.js`, `pmaSchedaArrayMerge.js`, `CartellaClinicaSection.tsx`, `ids.js`, `FarmacoNomeSuggestInput.jsx`

**Setup:** 2 PC o 2 browser, stesso paziente PMA aperto

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 2.1 | PC A aggiunge farmaco → PC B aggiunge **altro** farmaco → entrambi visibili | ☐ | ☐ | |
| 2.2 | PC A aggiunge parametro vitale → PC B ne aggiunge un altro → entrambi visibili | ☐ | ☐ | |
| 2.3 | PC A modifica riga esistente → PC B non perde le proprie righe | ☐ | ☐ | |
| 2.4 | Aggiunta prestazione / rivalutazione da 2 operatori | ☐ | ☐ | |
| 2.5 | Lesioni body map: aggiunta da 2 operatori | ☐ | ☐ | |
| 2.6 | Digitare nome farmaco → compaiono **suggerimenti** da catalogo impostazioni | ☐ | ☐ | |
| 2.7 | Farmaco selezionato da catalogo visibile anche su altro PC (non testo libero vuoto) | ☐ | ☐ | |
| 2.8 | Login **medico** su `http://192.168.x.x:5320` → aggiunta farmaco/PV senza errore `crypto.randomUUID` | ☐ | ☐ | |
| 2.9 | Nessun blocco "campo in uso da altro operatore" su farmaci/PV | ☐ | ☐ | |

**Note sezione 2:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 3. Centrale — Creazione paziente / valutazioni MSB-MSA

**File coinvolti:** `valutazioneLesioni.js`, `valutazioniSoccorsoPayload.js`, `valutazioneSoccorsoGranularUpdate.js`, `PazienteScheda.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 3.1 | Nuovo paziente con MSB + almeno 1 lesione → salva senza errore `Nested arrays` | ☐ | ☐ | |
| 3.2 | Nuovo paziente con MSA + lesioni → salva OK | ☐ | ☐ | |
| 3.3 | Modifica lesione esistente → salva OK | ☐ | ☐ | |
| 3.4 | Stesso paziente su altro browser → lesioni coerenti | ☐ | ☐ | |
| 3.5 | (Opz.) Export CSV: lesioni in formato oggetto accettabile | ☐ | ☐ | |

**Note sezione 3:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 4. Auth / Popup dashboard kiosk

**File coinvolti:** `AuthContext.jsx`, `RequireAuth.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 4.1 | Dashboard → popup kiosk Eventi → carica dati (non resta su "Verifica accesso") | ☐ | ☐ | |
| 4.2 | Popup kiosk Mezzi / Mappa / PMA → stesso comportamento | ☐ | ☐ | |
| 4.3 | Popup si apre entro pochi secondi (max ~4s) | ☐ | ☐ | |
| 4.4 | Utente senza permessi impostazioni → tab Impostazioni in sola lettura fino a profilo caricato | ☐ | ☐ | |

**Note sezione 4:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 5. Dashboard / Kiosk — Auto-close evento

**File coinvolti:** `useOperativoDashboardData.js`, `eventoAutoCloseService.js`, `Kiosk*Page.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 5.1 | Kiosk aperto a lungo → nessun errore permessi in console | ☐ | ☐ | |
| 5.2 | Evento: tutte missioni chiuse + nessun paziente blocker → `operativoTerminato` automatico | ☐ | ☐ | |
| 5.3 | **Riapri evento** → auto-close può ripartire senza reload pagina | ☐ | ☐ | |
| 5.4 | Evento con `operativoAutoCloseSospeso` → non si chiude da solo | ☐ | ☐ | |

**Note sezione 5:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 6. Eventi / Missioni / Mezzi

**File coinvolti:** `eventiService.js`, `missioniService.js`, `missioniEccezioniService.js`, `telegramSideEffects.js`, `eventoMissioneMatch.js`, `missionAdmin.js`, `EventoScheda.jsx`, `MissioneScheda.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 6.1 | Crea evento → crea missione → assegna mezzo → flusso base OK | ☐ | ☐ | |
| 6.2 | Avanza stati missione (incluso DIRETTO H / ARRIVATO H) → sync `statoPzPma` | ☐ | ☐ | |
| 6.3 | Dirottamento missione → missione figlia creata correttamente | ☐ | ☐ | |
| 6.4 | Delete evento → nessun orfano missioni/pazienti | ☐ | ☐ | |
| 6.5 | Scheda mezzo → forza **Non disponibile** → missione chiusa, mezzo scollegato | ☐ | ☐ | |
| 6.6 | Scheda mezzo → forza **Disponibile** con missione aperta → nessun errore, missione chiusa | ☐ | ☐ | |
| 6.7 | **Invia mezzo** da dashboard → funziona (regressione critica) | ☐ | ☐ | |
| 6.8 | Tratte missione: aggiunta/rimozione da 2 operatori → nessuna tratta persa | ☐ | ☐ | |
| 6.9 | Cambio stato missione → nessun errore console `notifyTelegramStato` / ReferenceError | ☐ | ☐ | |

**Note sezione 6:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 7. Codici colore paziente ↔ mezzo (T)

**File coinvolti:** `PazienteScheda.jsx`, `missioniService.js`, `codiciColore.js`, `MissioneScheda.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 7.1 | Paziente giallo + lega mezzo → codice T missione = giallo | ☐ | ☐ | |
| 7.2 | Cambia colore paziente → T si aggiorna (se non impostato manuale su missione) | ☐ | ☐ | |
| 7.3 | Paziente senza colore + lega mezzo → scegli colore paziente → T copiato | ☐ | ☐ | |
| 7.4 | Invio PS da PMA → codici E/M/T coerenti con paziente PMA | ☐ | ☐ | |
| 7.5 | Colore paziente in scheda centrale visibile prima di Esito/Trasporto | ☐ | ☐ | |

**Note sezione 7:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 8. Impostazioni — patch granulari (CRITICO)

**File coinvolti:** `impostazioniService.js`, `granularFirestorePatch.js`, editor impostazioni (`DettagliPerTipoLuogoEditor`, `PmaClinicaImpostazioniPanel`, ecc.)

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 8.1 | Modifica **solo** un dettaglio luogo → salva → altri campi intatti | ☐ | ☐ | |
| 8.2 | Modifica PMA clinica (es. aggiungi farmaco catalogo) → altri campi intatti | ☐ | ☐ | |
| 8.3 | Modifica stazionamenti → altri campi intatti | ☐ | ☐ | |
| 8.4 | Due operatori su sezioni impostazioni diverse contemporaneamente | ☐ | ☐ | |

**Note sezione 8:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 9. Pazienti — sync / codice minore

**File coinvolti:** `eventoMissioneMatch.js`, `pazientiTrasportoQuery.js`, `patchPazienteCodiceMinore.js`, `PazienteScheda.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 9.1 | Paziente trasporto compare in sezione pazienti della missione | ☐ | ☐ | |
| 9.2 | Codice minore PMA: salva campi/foto → altri campi paziente intatti | ☐ | ☐ | |
| 9.3 | Cambio mezzo su paziente → `idMissione` / link missione aggiornati | ☐ | ☐ | |
| 9.4 | Stato centrale e stato PMA visibili e coerenti in scheda | ☐ | ☐ | |

**Note sezione 9:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 10. GPS / posizione mezzo

**File coinvolti:** `mezzoPosizione.js`, `telegramGpsFlow.js`, `StatoMezziTable.jsx`, `MappaTatticaDashboard.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 10.1 | Mezzo in missione con GPS Telegram recente → mappa mostra posizione reale | ☐ | ☐ | |
| 10.2 | GPS assente o vecchio → mezzo su stazionamento / indirizzo default | ☐ | ☐ | |
| 10.3 | Dashboard Stato Mezzi: colonna stazionamento = nome stazionamento o indirizzo default mezzo | ☐ | ☐ | |

**Note sezione 10:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 11. Telegram

**File coinvolti:** `telegramKeyboard.js`, `telegramStatoFlow.js`, `telegramSideEffects.js`, `telegramService.js`, `missionAdmin.js`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 11.1 | Bot: menu stati con pulsanti **inline keyboard** + emoji | ☐ | ☐ | |
| 11.2 | Avanza stato da centrale → equipaggio Telegram aggiornato | ☐ | ☐ | |
| 11.3 | Avanza stato da Telegram → sync PMA (DIRETTO H → alert arrivo) | ☐ | ☐ | |
| 11.4 | Bot spento / errore Telegram → centrale continua a funzionare | ☐ | ☐ | |

**Note sezione 11:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 12. Wipe dati operativi

**File coinvolti:** `scripts/wipe-ops-data.mjs`, `wipeOpsDataService.js`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 12.1 | Dopo wipe CLI: nessun evento/missione/paziente test residuo | ☐ | ☐ | |
| 12.2 | Dopo wipe: tutti i mezzi **Disponibile**, `operativo: true` | ☐ | ☐ | |
| 12.3 | (Se usi UI wipe) opzioni selezionate corrette prima di confermare | ☐ | ☐ | |

**Note sezione 12:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## 13. UI Dashboard

**File coinvolti:** `EventiMissioniTable.jsx`, `StatoMezziTable.jsx`, `DashboardPage.jsx`

| # | Test | OK | KO | Note |
|---|------|:--:|:--:|------|
| 13.1 | Tabella Eventi/Missioni: colonna operatore creatore visibile | ☐ | ☐ | |
| 13.2 | Colonne compatte: ORA, MISSIONE, MEZZO, USER leggibili | ☐ | ☐ | |
| 13.3 | Evento con più missioni: dati evento allineati alla **prima** missione (in alto) | ☐ | ☐ | |
| 13.4 | Codici colore E, M, T allineati nelle colonne | ☐ | ☐ | |
| 13.5 | Stato Mezzi: colonna OPERATIVO assente; mezzi non disponibili in fondo lista | ☐ | ☐ | |
| 13.6 | Termina evento → modale si chiude | ☐ | ☐ | |

**Note sezione 13:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## Flusso end-to-end (ordine consigliato)

Segna ✅ solo se **tutto** il flusso è OK.

| # | Step | OK | KO | Note |
|---|------|:--:|:--:|------|
| E2E-1 | Login centrale + login PMA (anche medico su LAN HTTP) | ☐ | ☐ | |
| E2E-2 | Impostazioni → salva un solo campo → altri campi intatti | ☐ | ☐ | |
| E2E-3 | Crea evento → missione → assegna mezzo | ☐ | ☐ | |
| E2E-4 | Crea paziente centrale con MSB + lesioni | ☐ | ☐ | |
| E2E-5 | Avanza missione → DIRETTO H → alert PMA + stato paziente | ☐ | ☐ | |
| E2E-6 | Cartella clinica: 2 operatori aggiungono farmaco + PV in parallelo | ☐ | ☐ | |
| E2E-7 | Dimissione (senza note/firma) → PDF / mailto | ☐ | ☐ | |
| E2E-8 | Termina operativo evento | ☐ | ☐ | |
| E2E-9 | (Opz.) Telegram: avanza stato da bot | ☐ | ☐ | |
| E2E-10 | Kiosk popup: nessun "Verifica accesso" bloccato | ☐ | ☐ | |

**Note flusso end-to-end:**

```
_________________________________________________________________
_________________________________________________________________
```

---

## Guida rapida — se qualcosa fallisce

| Sintomo | Dove guardare per primo |
|---------|-------------------------|
| `Nested arrays` in creazione paziente | `valutazioniSoccorsoPayload.js`, `valutazioneLesioni.js` |
| `crypto.randomUUID` su LAN | `ids.js`, `CartellaClinicaSection.tsx` |
| Secondo operatore non aggiunge farmaco/PV | `pazientePmaPatch.js`, `PmaFieldPresenceContext.tsx` |
| Campi impostazioni svuotati dopo save | `impostazioniService.js`, editor impostazioni |
| Popup "Verifica accesso" bloccato | `AuthContext.jsx` |
| Errore invio mezzo | `missioniService.js`, `mezzoDisponibileService.js` |
| Stato missione / PMA disallineato | `missioniService.js`, `pazientePmaMissionSync.js`, `missionAdmin.js` |
| Notifica arrivo PMA assente | sync DIRETTO H, `PmaArrivoAlertListener` |

---

## Aperti / NON fixati (non segnare come regressione)

- [ ] P0-02 — Create evento+missione non atomico
- [ ] P1-02 — Auto-close API ignora `operativoAutoCloseSospeso`
- [ ] P1-03 — Race doppio ingaggio stesso mezzo
- [ ] P2-07 — Parità client vs `pazienteMissionPmaAdmin.js`
- [ ] C1–C4 — Firestore rules aperte, API Telegram senza ruolo admin
- [ ] Audit PMA (PMA-01…17) — elencato ma non implementato su richiesta

Dettaglio in: `logs/MAIN-V5-errori-fix-rischi.txt`

---

## Esito finale

| | |
|---|---|
| **Esito complessivo** | ☐ Tutto OK · ☐ KO parziali · ☐ Bloccante |
| **Deploy Vercel verificato** | ☐ Sì · ☐ No |
| **Prossima azione** | |

**Firma / data chiusura test:** _______________
