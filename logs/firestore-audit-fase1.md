# FASE 1 — Audit scritture Firestore (granularità)

**Data audit:** 2026-05-28  
**Stato:** solo lettura — nessuna modifica applicata  
**Contesto:** app multi-utente su Firestore; ogni violazione può causare perdita di dati di altri operatori.

## Regole di riferimento

**Corretto:**
- `updateDoc(ref, { campoSpecifico: nuovoValore })`
- `updateDoc(ref, { 'oggettoAnnidato.campo': valore })`
- `setDoc(ref, { campo: valore }, { merge: true })`
- `transaction.update(ref, { campoSpecifico: valore })`

**Vietato:**
- `setDoc(ref, { ...tuttoLOggetto })` → sovrascrive tutto
- `setDoc(ref, stateLocale)` → sovrascrive tutto
- `updateDoc(ref, { ...stateLocaleCompleto })` → sovrascrive campi altrui
- `transaction.set(ref, { ...oggettoCompleto })` senza `merge: true`

**Violazione:** qualsiasi caso in cui setDoc/updateDoc riceve campi che l'operatore non ha toccato nell'operazione corrente (spread state locale, onSave wholesale, ecc.).

**Legenda tabella — Violazione?:**
- **Sì** = rischio perdita dati concorrenti secondo le regole indicate
- **No** = granulare / transazione con merge / creazione documento
- **—** = nessuna scrittura Firestore nel file

---

## `src/services/impostazioniService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| impostazioniService.js | `ensureImpostazioniDocument` | `setDoc` + `{ merge: true }` | Solo `manifestationId` se doc assente | No |
| impostazioniService.js | `appendImpostazioniScalarArrayItem` | `runTransaction` → `update` / `set` merge | Array scalare: read server + append | No |
| impostazioniService.js | `removeImpostazioniScalarArrayItem` | `runTransaction` → `update` | Array scalare: read server + filter | No |
| impostazioniService.js | `saveImpostazioniArrayEntryById` | `runTransaction` → `update` / `set` merge | Intero array `stazionamenti`/`pma`, ma merge voce per `id` | No |
| impostazioniService.js | `deleteImpostazioniArrayEntryById` | `runTransaction` → `update` | Intero array, read server + filter per `id` | No |
| impostazioniService.js | `replaceImpostazioniArrayField` | `saveImpostazioniDotPath` | **Sostituisce intero array** | **Sì** (bulk; ok solo se unico operatore / import confermato) |
| impostazioniService.js | `saveImpostazioniMapEntry` | `runTransaction` → `FieldPath.update` | **Una chiave mappa** (es. lista intera per un tipo) | **Sì** se due operatori editano voci diverse nella stessa lista-tipo |
| impostazioniService.js | `deleteImpostazioniMapEntry` | come sopra | Una chiave mappa | No (delete puntuale) |
| impostazioniService.js | `saveImpostazioniDotPath` | `runTransaction` → `update` | **Un path top-level** (valore intero del campo) | Dipende dal campo (vedi chiamanti) |
| impostazioniService.js | `saveImpostazioniField` | → `saveImpostazioniDotPath` | **Intero campo top-level** (array/scalare) | **Sì** per array condivisi senza merge transazionale |
| impostazioniService.js | `savePmaClinicaDotFields` | `runTransaction` → `update` dot-path | Solo sottochiavi `pmaClinica.*` cambiate | **Sì** se il valore è un array intero (`farmaci`, `prestazioni`, …) senza merge per elemento |
| impostazioniService.js | `saveDettaglioTipoEvento` / `saveDettaglioTipoLuogo` | → `saveImpostazioniMapEntry` | Lista intera per un tipo | **Sì** (stesso rischio map entry) |
| impostazioniService.js | `updateImpostazioniDocument` / `patchImpostazioni` | delega API puntate | Per chiave | No (se usato come previsto) |
| impostazioniService.js | `createImpostazioniDocument` | `setDoc` + merge | Doc iniziale manifestazione | No (creazione) |

---

## `src/components/impostazioni/*.jsx`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| ChiamantiEventoEditor.jsx | `ListEditorField` → `saveField` | `saveImpostazioniField` | **Intero `chiamantiEvento`** da textarea | **Sì** |
| ListEditorField.jsx | `onSave` | `saveImpostazioniField` | **Intero array** del `fieldKey` | **Sì** |
| ListEditor.jsx | `handleSave` | callback parent | Costruisce lista completa dal draft | **Sì** (UI wholesale) |
| ImpostazioniScalarListField.jsx | `onSave` | `saveImpostazioniField` | **Intero array** (`lesioniLocalizzazioni`, `lesioniTipologie`, `msbMsaPresidi`, `prestazioniMsb`, `prestazioniMsa`) | **Sì** |
| ValutazioniMsbMsaImpostazioniEditor.jsx | `persistVasMax` | `saveImpostazioniField` | Singolo scalare `lesioniVasMax` | No |
| ValutazioniMsbMsaImpostazioniEditor.jsx | figli `ImpostazioniScalarListField` | come sopra | Array interi | **Sì** |
| TipiMezzoEditor.jsx | `handleSave` | `saveField` → `saveImpostazioniField` | **Intero `tipiMezzo`** | **Sì** |
| TipiEventoChipsEditor.jsx | `addItem` / `remove` | `append/removeImpostazioniScalarArrayItem` | Transazione per voce | No |
| TipiLuogoChipsEditor.jsx | idem | transazione | Per voce | No |
| ScalarArrayChipsEditor.jsx | `addItem` / `remove` | transazione | Per voce | No |
| DettagliPerTipoEditor.jsx | `saveTipo` | `saveDettaglioTipoEvento` | **Lista intera** per un `tipoEvento` | **Sì** |
| DettagliPerTipoLuogoEditor.jsx | `saveTipo` | `saveDettaglioTipoLuogo` | **Lista intera** per un `tipoLuogo` | **Sì** |
| StazionamentiEditor.jsx | `persistEntry` | `saveImpostazioniArrayEntryById` | Una voce `stazionamenti` | No |
| StazionamentiEditor.jsx | `persistBulkReplace` (import) | `replaceImpostazioniArrayField` | **Intero `stazionamenti`** | **Sì** (bulk intenzionale) |
| PmaEditor.jsx / PmaMapModal.jsx | save voce | `saveImpostazioniArrayEntryById` | Una voce `pma` | No |
| MappaDashboardCentroEditor.jsx | `handleApply` / `handleClear` | `saveField` | **Oggetto intero `mappaDashboardDefault`** `{luogo,lat,lng,zoom}` | **Sì** |
| InfoLuogoPanel.jsx | `saveUrl` / `saveLuogo` | `saveField` | Singolo campo (`piantina_url`, `luogo_fisico`) | No |
| GuidaPdfPanel.jsx | save guida | `saveField` | Singolo `guida_pdf_url` | No |
| TelegramGpsTrackingToggle.jsx | toggle | `saveImpostazioniField` | Singolo booleano | No |
| PmaClinicaImpostazioniPanel.jsx | `persist` / `buildChangedDotFields` | `savePmaClinicaDotFields` | Solo sottochiavi dirty; ma array **`farmaci`**, **`prestazioni`**, **`preset_dimissione`**, **`farmaci_consumati`** sono sostituiti interi | **Sì** (consumati: esiste API merge separata ma qui passa da dot-fields) |
| FarmaciSelezionabiliEditor.jsx | `commit` | nessuna (solo `onChange` parent) | — | — |
| FarmaciConsumatiStatsEditor.jsx | `onClearRemote` | `clearPmaClinicaFarmaciConsumati` (service esterno) | Azzeramento con merge transazionale | No |
| ImpostazioniEventiPanel.jsx, SaveFeedback.jsx, ActiveUsersPanel.jsx, UserAccountsEditor.jsx, ChangelogLogPanel.jsx, Telegram*Panel.jsx, GlobalLogoutPuliziaPanel.jsx, PartecipantiRegistryEditor.jsx, WipeOpsDangerZone.jsx | — | — | — | — |

*ImpostazioniPage.jsx usa i componenti sopra: `ListEditorField` per `listaOspedali`, `TipiMezzoEditor`, ecc.*

---

## `src/services/pazientiService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| pazientiService.js | `createPaziente` | `writeBatch.set` | Nuovo doc paziente + sottocollezione valutazioni | No (creazione) |
| pazientiService.js | `patchPaziente` | `updateDoc` | Solo chiavi nel `fields` (blocca `pmaScheda`/`codiceMinore` interi) | No* |
| pazientiService.js | `setValutazioneSoccorsoDoc` | `setDoc` senza merge | **Intero doc** sottocollezione (nuovo `id`) | No (doc dedicato, prima scrittura) |
| pazientiService.js | `persistValutazioneSoccorsoSnapshot` | `setDoc` + merge | Snapshot doc valutazione | No |
| pazientiService.js | `updateValutazioneSoccorsoDoc` | `runTransaction` → `update` | Path puntati via `buildValutazioneGranularUpdates` | No |
| pazientiService.js | `deleteValutazioneSoccorsoDoc` | `deleteDoc` | — | No |
| pazientiService.js | `syncPazienteArrivatoH` / `transitionPazientePmaInArrivoIfAllowed` | `runTransaction` → `update` | Campi specifici da logica server | No |
| pazientiService.js | `migrateLegacyValutazioniIfNeeded` | `writeBatch` + `updateDoc` | Migrazione una tantum | No (fuori flusso operativo) |
| pazientiService.js | `deletePazienteCascade` | `deleteDoc` / batch | — | No |

\*Violazione dipende dal **caller** se passa troppi campi (vedi componenti).

---

## `src/services/missioniService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| missioniService.js | `syncMissioneCodiceColoreTrasportoForPaziente` | `updateDoc` | Singolo `codiceColoreTrasporto` | No |
| missioniService.js | `patchMissione` (senza tratte) | `updateDoc` | Solo chiavi in `fields` | No* |
| missioniService.js | `patchMissione` (con `tratteMissione`) | `runTransaction` → `update` | Array tratte: **client invia array locale**, server fa `mergeTratteMissioneWrite` | No |
| missioniService.js | `deleteMissione` | `deleteDoc` | — | No |
| missioniService.js | `createMissione` / eccezioni | `addDoc` / patch correlate | Creazione | No |

\*`patchEsitoMissione` invia anche `esitoMissioneAltro: ''` insieme a `esitoMissione`: correlazione intenzionale, non wholesale scheda.

---

## `src/services/eventiService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| eventiService.js | `createEvento` | `addDoc` | Nuovo evento | No |
| eventiService.js | `patchEvento` | `updateDoc` | Solo chiavi in `fields` | No* |
| eventiService.js | `terminaEventoOperatore` / `riapriEventoOperatore` | `patchEvento` | 2–3 campi correlati | No |
| eventiService.js | `closeEventoForzato` | `patchEvento` + `patchMissione` | Chiusura orchestrata | No |
| eventiService.js | `deleteEvento` | `deleteDoc` + cascade | — | No |

\*Caller deve passare patch piccole (vedi `EventoScheda`).

---

## `src/services/mezziService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| mezziService.js | `createMezzo` | `setDoc` + merge | Nuovo mezzo | No |
| mezziService.js | `patchMezzo` | `updateDoc` | Path puntati (`flattenMezzoPatchFields`) | No |
| mezziService.js | `deleteMezzo` | `deleteDoc` | — | No |

---

## `src/services/diarioService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| diarioService.js | `createNotaDiario` | `addDoc` | Nuova nota | No |
| diarioService.js | `patchNotaDiario` | `updateDoc` + spread `fields` | Tutte le chiavi passate dal caller | No* |
| diarioService.js | `deleteNotaDiario` | `deleteDoc` | — | No |

\*Il service è neutro; la violazione è nel caller che invia l'intero form.

---

## `src/services/pmaStatoService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| pmaStatoService.js | `prendiInCaricoPma` | `runTransaction` → `update` | `statoPzPma` + `pmaScheda.ingresso_carico_at` | No |
| pmaStatoService.js | `setStatoPmaAutopresentato` | `patchPaziente` | Singolo `statoPzPma` | No |

---

## `src/services/pmaCodiceMinoreService.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| pmaCodiceMinoreService.js | `createPazienteCodiceMinore` | → `createPaziente` | Creazione | No |
| pmaCodiceMinoreService.js | `updatePazienteCodiceMinore` | → `patchPazienteCodiceMinoreScalars` | **Tutti gli scalari** anagrafica + tutti i campi `codiceMinore.*` + `statoPzPma` + `aperta` dal payload form | **Sì** |
| pmaCodiceMinoreService.js | `deletePazienteCodiceMinore` | cascade delete | — | No |

---

## `src/pma/lib/pazientePmaPatch.js`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| pazientePmaPatch.js | `ensurePmaSchedaEoDefaultsIfEmpty` | `runTransaction` → `update` | Dot-path solo colonne EO vuote | No |
| pazientePmaPatch.js | `initPmaSchedaIfMissing` | `runTransaction` → `update` | Init path puntati se `pmaScheda` assente | No |
| pazientePmaPatch.js | `patchPazientePmaGranular` | `runTransaction` → `update` | Path puntati; array con **merge transazionale** (`mergeSchedaArrayById` / EO / `prestazioni_sel`) | No* |

\*Violazione se il **caller** passa troppi campi non modificati (vedi componenti PMA).

---

## `src/pma/components/` (`.tsx` / `.jsx`)

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| PmaSchedaRiepilogo.tsx | `flushAnagrafica` (onBlur qualsiasi campo) | `write` → `patchPazientePmaGranular` | **Tutti i campi anagrafica** dal draft | **Sì** |
| PmaSchedaRiepilogo.tsx | `flushEvento` | idem | `tipo_evento` + `dettaglio_evento` | No (coppia correlata) |
| PmaAnagraficaSection.tsx | `saveAnagrafica` (pulsante) | idem | **6 campi** dal draft | **Sì** |
| PmaAnagraficaSection.tsx | `onBlur` breve / click colore | idem | Singolo campo | No |
| CartellaClinicaSection.tsx | `patchPv` / `patchFarmaco` / toggle / blur | idem | Array intero in patch, **merge per `id` in transazione** | No |
| CartellaClinicaSection.tsx | scalar blur (`allergie`, `apr`, `codice_colore`, …) | idem | Singolo campo | No |
| DimissioneSection.tsx | campi onBlur / onChange | idem | Singolo campo (o coppia firma correlata) | No |
| DimissioneSection.tsx | `handleDimettiConfirm` | idem | Bundle dimissione (`aperto`, `stato`, `dimesso_at`, …) | No (operazione atomica) |
| Altri 17 file PMA (`InvioOspedaleSection`, `DettaglioPaziente`, `PmaFieldGuard`, …) | — | — | Nessuna scrittura diretta | — |

---

## `src/components/pazienti/*.jsx`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| PazienteScheda.jsx | `patchPatientFields` / `onBlurField` | `patchPaziente` | Campo(i) passati (per-key on blur) | No |
| PazienteScheda.jsx | `applyDestinazioneChange` | `patchPaziente` | Bundle destinazione correlata (5–8 campi) | No (azione semantica unica) |
| PazienteScheda.jsx | `onEsitoChange` / `onMissioneChange` | `patchPaziente` | Bundle campi esito/missione correlati | No |
| PazienteScheda.jsx | `patchMsb/MsaValutazione` | `updateValutazioneSoccorsoDoc` | Partial → dot-path | No |
| PazienteScheda.jsx | `addValutazione` | `setValutazioneSoccorsoDoc` | Nuovo doc sottocollezione | No |
| PazienteScheda.jsx | `SchedaUnlockBar` | `patchPaziente` | Singolo `schedaModificaForzata` | No |
| PazienteAnagraficaPmaTab.jsx | `onBlurField` | `patchPaziente` | 1–2 campi per blur | No |
| PazienteModuloPma.jsx | `write` | `patchPazientePmaGranular` | Dipende dal patch | No* |
| PazienteModuloPma.jsx | `onWriteSoreu` (`InvioPsSoreuTrasportoBlock`) | idem | **Sempre 4 campi** `invio_ps_soreu_*` da merge locale | **Sì** |
| PazienteModuloPma.jsx | `SchedaUnlockBar` | `patchPaziente` | Singolo campo | No |
| Msb/Msa/Acc/Valutazione*Form, PazienteAnagraficaFields, ecc. | — | — | Solo UI; parent fa patch granulare | — |

---

## `src/components/missioni/*.jsx`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| MissioneScheda.jsx | `persistTratte` | `patchMissione` | Array tratte locale → merge transazionale | No |
| MissioneScheda.jsx | `patchColoreMissione/Trasporto` | idem | 1 campo | No |
| MissioneScheda.jsx | `patchEsitoMissione` | idem | `esitoMissione` (+ `esitoMissioneAltro`) | No |
| MissioneScheda.jsx | `impostaStatoOra` | idem | `buildStatoChangeFields` (dot-path storico) | No |
| MissioneScheda.jsx | `onStoricoBlur` | idem | `patchStoricoStatoAt` (singola chiave storico) | No |
| MissioneScheda.jsx | `onAperturaMissioneBlur` / note onBlur | idem | Singolo campo | No |
| MissioneEccezioniPanel.jsx | `run` → `missioniEccezioniService` | fuori scope file service | — | — |
| Altri missioni/*.jsx | — | — | Nessuna scrittura diretta | — |

---

## `src/components/eventi/*.jsx`

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| EventoScheda.jsx | `patch` helper | `patchEvento` | Campi passati dal form | No* |
| EventoScheda.jsx | auto-close operativo | `patchEvento` | `operativoTerminato` + timestamp | No |
| EventoScheda.jsx | `onEventoAperturaBlur` | idem | `apertura` | No |
| EventoScheda.jsx | `commitLocation` | idem | `indirizzo` + `coordinate` (coppia correlata) | No |
| EventoScheda.jsx | ripristino auto-close su nuova missione | idem | `deleteField(operativoAutoCloseSospeso)` | No |
| EventoDettaglioForm.jsx | `onPatch` / `onTipoChange` / `onLuogoChange` | via parent | 1–2 campi per interazione | No |
| EventoDettaglioForm.jsx | `noteEvento` onChange | via parent | Singolo campo (live) | No |

\*`noteEvento` scrive a ogni keystroke: non è wholesale, ma è frequente; non è violazione concorrenza, solo nota performance.

---

## Diario (hook usato da `DiarioPage.jsx`, service in scope)

| File | Funzione/Handler | Metodo Firestore | Scrive campo singolo o oggetto intero? | Violazione? |
|------|------------------|------------------|----------------------------------------|-------------|
| useDiarioNotaActions.js | `updateNota` | `patchNotaDiario` | **Intero payload form** (`titolo`, `testo`, `importante`, `pdfUrl`, `pdfFilename`) | **Sì** |
| useDiarioNotaActions.js | `toggleChiusa` / `toggleImportante` | idem | Singolo campo | No |
| DiarioPage.jsx | `handleSave` (modifica) | → `updateNota` | Form completo | **Sì** |

---

## Riepilogo violazioni (FASE 2 — da correggere dopo conferma)

| Priorità | Area | Problema |
|----------|------|----------|
| **Alta** | Impostazioni — `ListEditor` / `TipiMezzo` / `MappaDashboardCentro` | Sostituzione intera di array/oggetti senza read-merge |
| **Alta** | Impostazioni — `dettagliPerTipo*` | Lista intera per chiave mappa |
| **Alta** | `PmaClinicaImpostazioniPanel` | Cataloghi `farmaci` / `prestazioni` / `preset_dimissione` / `farmaci_consumati` sostituiti interi |
| **Media** | Diario `updateNota` | Salvataggio form invia tutti i campi, non solo quelli dirty |
| **Media** | `updatePazienteCodiceMinore` | Salvataggio form invia tutti gli scalari |
| **Media** | PMA `PmaSchedaRiepilogo` / `PmaAnagraficaSection` | Blur/salva anagrafica wholesale su `pmaScheda` |
| **Media** | `PazienteModuloPma` SOREU | Sempre 4 campi `invio_ps_soreu_*` |
| **Bassa** | `StazionamentiEditor` import | Bulk replace intenzionale ma rischio se concorrente |

### Già corretti / protetti

- `impostazioniService` transazioni per chip/scalar append, `stazionamenti`/`pma` per voce
- `patchPazientePmaGranular` con merge array
- `patchMissione` tratte con `mergeTratteMissioneWrite`
- Valutazioni MSB/MSA con `buildValutazioneGranularUpdates`
- `patchPaziente` / `patchMezzo` con guard rail

---

## Pattern di fix previsti (FASE 2)

```javascript
// Prima (sbagliato):
await updateDoc(ref, { ...tutteLeImpostazioni })

// Dopo (corretto):
await updateDoc(ref, { nomeCampoModificato: nuovoValore })
```

```javascript
// Oggetti annidati — prima:
await updateDoc(ref, { oggettoAnnidato: { ...oggettoCompleto } })

// Dopo:
await updateDoc(ref, { 'oggettoAnnidato.campoSpecifico': nuovoValore })
```

```javascript
// Form batch — costruire patch solo con campi dirty:
const patch = {}
if (draft.campo1 !== original.campo1) patch.campo1 = draft.campo1
if (draft.campo2 !== original.campo2) patch.campo2 = draft.campo2
if (Object.keys(patch).length > 0) await updateDoc(ref, patch)
```
