# Log fix audit CROSS (2026-05-26)

Elenco interventi applicati dopo la code review. Ogni voce indica **file toccati** e **motivo**.

---

## Critici

| # | Fix | File |
|---|-----|------|
| C1 | Firma iPad: validazione `requestId` / `pazienteDocId` / stato `pending` / scadenza in transazione prima di salvare; errore se coda non valida; update coda senza `.catch(() => {})` | `src/services/pmaIpadFirmaService.js` |
| C2 | Rimosso componente morto `SchedaPaziente.tsx` (import `@pma/lib/updateSchedaPaziente` inesistente, mai usato da `App.jsx`). Flusso attivo: `PazienteScheda.jsx` + `PazienteModuloPma.jsx` | **Eliminato** `src/pma/components/scheda-paziente/SchedaPaziente.tsx` |

---

## Alti

| # | Fix | File |
|---|-----|------|
| A1 | `resolveCodiceColoreMissione`: solo `codiceColoreMissione`, senza fallback legacy `codiceColore` | `src/lib/codiciColore.js` |
| A2 | Telegram missione: stesso criterio per colore M | `src/lib/telegramMissionPayload.js`, `api/_lib/telegramMissionMessage.js` |
| A3 | Dirottamento / flag-down: M opzionale (`optionalColoreMissionePayload`), non più `Bianco` forzato | `src/services/missioniEccezioniService.js` |
| A4 | Invio PS da PMA: M solo se codice trasporto PMA mappato; evento E resta `Bianco` se assente codice | `src/services/pmaInvioPsTrasportoService.js` |
| A5 | `omitUndefinedFields` prima di `updateDoc` (Firestore rifiuta `undefined`) | `src/lib/firestorePatch.js` (nuovo), `src/services/pazientiService.js`, `src/pma/lib/pazientePmaPatch.js` |
| A6 | Chiusura operativa automatica evento: guard ref + `catch` + log | `src/components/eventi/EventoScheda.jsx` |

---

## Medi

| # | Fix | File |
|---|-----|------|
| M1 | Snapshot paziente: callback errore + banner UI | `src/components/pazienti/PazienteScheda.jsx` |
| M2 | Sync ARRIVATO H: una transazione per coppia paziente/missione (ref), `catch` con reset | `src/components/pazienti/PazienteScheda.jsx` |
| M3 | `SessionRevocationGuard`: flag `cancelled` su cleanup async | `src/components/auth/SessionRevocationGuard.jsx` |

---

## Già presenti prima di questo giro (sessioni precedenti)

- `PazienteScheda`: ordine dichiarazione `schedaSolaVisione` / `moduli` (fix crash create).
- `EventoScheda`: `—` al posto di `?` nel select mezzi.
- PDF iPad multi-pagina (`PdfMultiPageViewer`).
- Colore M in nuova missione: scelta manuale, default «nessun colore» (`ColoreSelectButtons`).

---

## Missioni / mezzi / tracking GPS (2026-05-26)

| # | Fix | File |
|---|-----|------|
| MI1 | Sigla mezzo canonica in create missione + `resolveMezzoDocIdFirestore` su patch mezzo | `missioniService.js`, `mezziService.js` |
| MI2 | Rilascio `statoMezzo` solo se nessun’altra missione blocca lo stesso mezzo (RIENTRO/FINE/ANNULLATA) | `missioniService.js`, `missionAdmin.js` |
| MI3 | Match mezzo fuzzy (BRAVO_1/BRAVO1): missione, pazienti trasporto, find missione | `mezzoMissione.js`, `pazienteRules.js`, `pazientiTrasportoQuery.js` |
| MI4 | `patchMissione` con `omitUndefinedFields` | `missioniService.js` |
| MI5 | Telegram advance: verifica mezzo normalizzata + stesso rilascio mezzo | `missionAdmin.js` |
| MI6 | UI: `findMezzoBySigla` in scheda missione/evento; dettaglio missione con colori M/T | `MissioneScheda.jsx`, `EventoScheda.jsx`, `EntityDetails.jsx` |

---

## Paziente — audit scheda e export (2026-05-26)

| # | Fix | File |
|---|-----|------|
| P1 | Export/viewer: `codiceColoreSanitario` + `apertura` (non `codiceColore`/`createdAt` root) | `export-firebase.mjs`, `pazienteColoreExport.js` |
| P2 | `normalizePatientDoc` include `codiceColoreSanitario` | `pazienteDefaults.js` |
| P3 | `updateValutazioneSoccorsoDoc` con `omitUndefinedFields` | `pazientiService.js` |
| P4 | Data «Creato» vuota → `deleteField()` su `apertura` (non `null`) | `PazienteScheda.jsx` |
| P5 | Destinazione PMA tardiva: `syncPmaStatoOnDestinazionePaziente` dopo cambio destinazione (missione già DIRETTO H / ARRIVATO H) | `PazienteScheda.jsx` |
| P6 | Creazione: draft `statoPzPma` IN ARRIVO se destinazione PMA prima del save | `PazienteScheda.jsx` |
| P7 | Cambio mezzo/esito Trasporta: aggiorna `idMissione` + `missioneIdUnivoco` su paziente | `PazienteScheda.jsx` |
| P8 | Query trasporto missione: `fetchPazientiTrasportoForMissione` (sigla normalizzata + fallback evento) | `pazientiTrasportoQuery.js`, `pazientiService.js`, `missioniService.js`, `pazientePmaMissionSync.js` |

---

## PMA — impostazioni, stati, cartella, rank (2026-05-26)

| # | Fix | File |
|---|-----|------|
| PM1 | Rank effettivo centrale/superadmin per dimissione e permessi (`effectivePmaUserRank`) | `userAccess.js`, `PazienteModuloPma.jsx` |
| PM2 | Tab shell PMA filtrate per rank (READ cartella/dimissione) | `schedaPazienteTabs.ts`, `PazienteModuloPma.jsx` |
| PM3 | Desk PMA: pazienti con destinazione PMA ma `statoPzPma` assente visibili (legacy) | `pmaModule.js` |
| PM4 | Rank Triage in matrice cartella + `normalizePmaRank` / operator profile | `rankMatrix.ts`, `userAccess.js`, `pmaModule.js` |
| PM5 | Desk: colonna «In arrivo» include legacy senza `statoPzPma` | `PmaDeskPage.jsx` |

---

## QA fix — logica operativa (2026-05-26)

| # | Fix | File | Non interferisce con |
|---|-----|------|----------------------|
| QA1 | Chiusura forzata: `ANNULLATA` resta annullata (`aperta: false` only) | `eventoChiusuraMissioni.js`, `eventiService.js` | Eccezioni già chiuse; missioni attive → ancora FINE MISSIONE |
| QA2 | Telegram DIRETTO H: salta pazienti PMA dimessi | `missionAdmin.js`, `pazienteMissionPmaAdmin.js` | Allineato a client `pazienteEsclusoDaSyncMissione` |
| QA3 | Auto-close evento Telegram: controlla pazienti aperti (come web) | `missionAdmin.js` | Stessa regola `shouldAutoCloseEvento` del client |
| QA4 | Sync ARRIVATO H scheda: mezzo normalizzato + match evento | `PazienteScheda.jsx` | `missioneIdUnivoco` ha priorità; `syncPazientiArrivatoH` invariato |
| QA5 | Delete valutazione MSB/MSA → ricalcolo colore T | `codiciColore.js`, `PazienteScheda.jsx` | Solo dopo delete; stesso path di patch MSB |
| QA6 | `prendiInCaricoPma`: un solo patch granulare | `pmaStatoService.js` | Stessi campi; `setStatoPmaAutopresentato` invariato |
| QA7 | `setPazientePmaInArrivo` non sovrascrive `IN ATTESA` | `pazientePmaMissionSync.js` | Autopresentati fuori tenda; IN_CARICO/DIMESSO ancora protetti |
| QA8 | Webhook Telegram: secret obbligatorio in produzione | `telegram-webhook.js` | Dev locale senza secret ancora consentito |

**Non modificato in questa passata (rischio interferenza / scope):** `firestore.rules`, `requireWebAdmin` su tutte le API.

---

## Richiesta operatore — manifestazione singola, PMA scope, lock, missioni, dimissione (2026-05-26)

| # | Fix | File |
|---|-----|------|
| U3 | Più doc in `manifestazioni`: usa il primo (warn console); niente schermata blocco «multiple» | `src/context/TenantContext.jsx`, `src/constants.js`, `.env.example` |
| U4 | Blocco nuova missione se mezzo ha già missione attiva (IN POSTO, …); RIENTRO/ARRIVATO H → `MezzoRientroMissioneApertaError` + conferma esistente | `src/services/missioniService.js` |
| U6 | Operatore PMA: liste eventi/missioni/mezzi/pazienti filtrate per `pmaScopeId` (centrale invariata) | `src/lib/manifestazioneDataScope.js`, `src/context/ManifestazioneDataContext.jsx` |
| U8 | Lock campi PMA: **una** transazione (snapshot lock + paziente), update solo path modificati, merge array/EO; release lock ritardato al blur; alias lock (`affidatario_*` → `affidatario`) | `pmaFieldPresenceService.js`, `pazientePmaPatch.js`, `pmaPatchSnapshot.js`, `pmaSchedaArrayMerge.js`, `pmaFieldLockKeys.js`, `PmaFieldPresenceContext.tsx`, `PazienteModuloPma.jsx` |
| U9 | Dimissione: validazione esito, note, firma paziente, PS/affidatario prima di «Dimetti» | `src/pma/lib/dimissioneValidate.ts`, `src/pma/components/scheda-paziente/DimissioneSection.tsx` |
| U10 | UI mobile PMA: modali farmaci/PV/prestazioni senza overflow, input 16px, tab centrate; allergie come campo normale | `PmaMobileSheet.tsx`, `CartellaClinicaSection.tsx`, `FarmacoNomeDoseFields.tsx`, `pma-theme.css` |

---

## Mezzi — audit e fix selezione (2026-05-26)

| # | Fix | File |
|---|-----|------|
| M1 | Filtro unico `filterMezziSelezionabiliPerNuovaMissione` (stato Disponibile + operativo + nessuna missione bloccante) | `mezzoMissione.js`, `EventoScheda.jsx`, `NuovoEventoRapidoForm.jsx`, `InvioPsSoreuTrasportoBlock.jsx` |
| M2 | Bug: evento rapido tattico non escludeva mezzi già in missione | `NuovoEventoRapidoForm.jsx` |
| M3 | Bug: scheda evento non escludeva mezzi `operativo: false` | `EventoScheda.jsx` |
| M4 | `patchMezzo` con `omitUndefinedFields` | `mezziService.js` |
| M5 | `stazionamentoPredefinito`: copia primo preset se luogo vuoto; edit + scheda | `mezzoStazionamentoPreset.js`, `MezziPage.jsx`, `MezzoScheda.jsx` |
| M6 | Blocco elimina mezzo con missioni aperte | `mezzoDeleteGuard.js` |
| M7 | Export `mezzi.csv` | `scripts/export-firebase.mjs` |

---

## Evento — campi e coerenza (2026-05-26)

| # | Fix | File |
|---|-----|------|
| E1 | Elenco `/eventi`: colonna luogo = `eventoColonnaIndirizzo` (luogo_fisico + indirizzo) | `EventiPage.jsx` |
| E2 | Colore E normalizzato in tabella eventi | `EventiPage.jsx` + `codiciColore.js` |
| E3 | Scheda missione: evento collegato usa stessa regola indirizzo | `MissioneScheda.jsx` |
| E4 | `patchEvento` / create: `omitUndefinedFields` + `normalizeCodiceColore` su `colore` | `eventiService.js` |
| E5 | Pannello dashboard evento: campi mancanti + indirizzo unificato | `EntityDetails.jsx` |
| E6 | Telegram: dettaglio, chiamante, colore E, meteo, indirizzo con fallback luogo_fisico | `telegramMissionPayload.js`, `telegramMissionMessage.js` |
| E7 | Export Firebase: `colore`, `apertura`, `noteEvento` (non codiceColore/createdAt/descrizione) | `scripts/export-firebase.mjs` |

---

## Non modificati in questo giro (backlog)

- Migrazione dati legacy `codiceColore` su missioni vecchie.
- Test automatici su `parseCodiceColoreOptional` / firma iPad.
- Firestore Security Rules (non analizzate).
- `PdfPreviewModal` iframe → PDF.js (solo iPad usa viewer completo).

---

## Verifica

```bash
npm run build
```
