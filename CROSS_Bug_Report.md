# CROSS — Bug Report & Prompt Cursor
*Analisi statica, giugno 2026*

---

## Come usare questo documento

Per ogni bug trovi:
- **Il problema** — cosa c'è di sbagliato e perché crea guai
- **Dove** — file e riga
- **Prompt Cursor** — copia/incolla nel chat di Cursor, uno alla volta

Segui l'ordine: i bug critici prima, poi quelli medi. Dopo ogni fix fai un test manuale rapido prima di passare al prossimo.

---

## BUG 1 — CRITICO: `changeStatoMissione` senza try/catch blocca silenziosamente

**Il problema**  
In `EventoScheda.jsx`, la funzione `changeStatoMissione` (linea ~265) viene usata come `onChange` del select stato missione. Se `patchMissione` fallisce (Firestore timeout, rete, errore validazione), l'errore viene inghiottito silenziosamente: l'utente vede il select che torna al valore precedente senza nessuna spiegazione. In più, `deleteEvento` nel pulsante "Elimina evento" (linea ~369) ha lo stesso problema.

**Dove**  
`src/components/eventi/EventoScheda.jsx` — funzioni `changeStatoMissione` e il onClick di "Elimina evento"

---

**Prompt Cursor #1**

```
In `src/components/eventi/EventoScheda.jsx` ci sono due handler async senza gestione errori.

1. La funzione `changeStatoMissione` (circa linea 265) fa `await patchMissione(...)` senza try/catch. 
   Aggiungile un try/catch che mostri un `alert('Errore cambio stato: ' + err.message)` in caso di fallimento.

2. Il pulsante "Elimina evento" (onClick circa linea 369) fa `await deleteEvento(...)` senza try/catch. 
   Avvolgi tutto il corpo dell'onClick in try/catch con `alert('Errore eliminazione evento: ' + err.message)`.

NON toccare nessun'altra parte del file. NON rinominare variabili. NON ristrutturare il codice.
```

---

## BUG 2 — CRITICO: Handler async in MissioneScheda senza propagazione errori

**Il problema**  
In `MissioneScheda.jsx`, le funzioni `impostaStatoOra`, `aggiungiTratta`, `patchColoreMissione`, `patchColoreTrasporto`, `patchEsitoMissione`, `rimuoviTratta`, `onTrattaQuandoBlur`, `onTrattaDescrizioneBlur` e `handleEliminaMissione` sono tutte async e chiamate con `void handler()` senza try/catch. Se qualsiasi scrittura Firestore fallisce, l'utente non vede nessun errore.

**Dove**  
`src/components/missioni/MissioneScheda.jsx` — tutti gli handler async

---

**Prompt Cursor #2**

```
In `src/components/missioni/MissioneScheda.jsx` le funzioni async `impostaStatoOra`, `aggiungiTratta`, 
`patchColoreMissione`, `patchColoreTrasporto`, `patchEsitoMissione`, `rimuoviTratta`, 
`onTrattaQuandoBlur`, `onTrattaDescrizioneBlur` NON hanno try/catch.

Per ognuna di queste funzioni, avvolgi il corpo esistente in try/catch e aggiungi:
  catch (err) { alert('Errore: ' + (err instanceof Error ? err.message : String(err))); }

`handleEliminaMissione` ha già un try/catch: non toccarla.

NON toccare nessun'altra parte del file. NON rinominare variabili. Modifica solo i corpi delle funzioni elencate.
```

---

## BUG 3 — IMPORTANTE: `reportError` di FirestoreSyncContext mai chiamato → indicatore online/offline sempre verde

**Il problema**  
In `ManifestazioneDataContext.jsx`, `reportError` (dal `FirestoreSyncContext`) è elencato nelle deps dell'`useEffect` ma non viene mai passato a `subscribeNested` come error handler: viene passata invece una funzione locale anonima. Risultato: quando Firestore va in errore su eventi/missioni/mezzi/pazienti, l'indicatore di connessione in header rimane verde e il badge di stato non riflette il problema.

**Dove**  
`src/context/ManifestazioneDataContext.jsx` — funzione `subscribeNested` e le 5 chiamate dentro `useEffect`

---

**Prompt Cursor #3**

```
In `src/context/ManifestazioneDataContext.jsx` c'è un bug: `reportError` (importato da FirestoreSyncContext) 
è nelle deps dell'useEffect ma non viene mai chiamato quando un listener Firestore fallisce.

La funzione `subscribeNested` riceve come 5° argomento un error handler locale. 

Modifica ogni chiamata a `subscribeNested` (sono 5, una per collezione) così:
- L'error handler locale (5° argomento) deve chiamare ANCHE `reportError(err)` OLTRE a `setError` e `markLoaded`.

Esempio di come deve diventare il 5° argomento per la collezione `eventi`:
  (err) => {
    reportError(err);          // ← aggiunto
    setError(err.message);
    markLoaded('eventi');
  }

Applica lo stesso pattern per missioni, mezzi, pazienti, noteDiario.
NON toccare altro. NON rinominare nulla.
```

---

## BUG 4 — IMPORTANTE: `useManifestationId()` lancia eccezione sincrona se tenant è null

**Il problema**  
`useManifestationId()` in `ManifestazioneContext.jsx` fa `throw new Error(...)` se il tenant non è ancora pronto. Qualsiasi componente che lo chiama durante il loading crasha l'intera app React invece di mostrare un loading state. Se per qualsiasi motivo (lentezza rete, re-render durante logout) il tenant è temporaneamente `null`, tutti i componenti che usano questo hook esplodono.

**Dove**  
`src/context/ManifestazioneContext.jsx` — funzione `useManifestationId`

---

**Prompt Cursor #4**

```
In `src/context/ManifestazioneContext.jsx`, la funzione `useManifestationId` lancia un'eccezione 
sincrona se `tenantId` non è disponibile. Questo causa crash dell'app durante il loading.

Modifica `useManifestationId` in questo modo:
- Se `loading` è true, ritorna una stringa vuota `''` invece di lanciare l'eccezione.
- Se `!tenantId` dopo che loading è false, ALLORA lancia l'errore.

Il corpo deve diventare:
  const { tenantId, loading } = useTenantContext();
  if (loading) return '';
  if (!tenantId) throw new Error('useManifestationId: tenant non disponibile');
  return tenantId;

ATTENZIONE: dopo questa modifica, tutti i servizi che ricevono `manifestationId` come stringa vuota 
devono già proteggersi (controlla che `useImpostazioni`, `useFirestoreCollection` e `ManifestazioneDataContext` 
abbiano già un guard `if (!manifestationId) return;` — in caso contrario segnalami i file che mancano 
del guard prima di procedere con le modifiche a quei file).

NON toccare nessun'altra parte del file.
```

---

## BUG 5 — MEDIO: `useImpostazioni` — callback `async` inutile in `onSnapshot`

**Il problema**  
In `useImpostazioni.js`, il callback passato a `onSnapshot` è dichiarato `async` ma non contiene nessun `await`. Questo è un code smell: se in futuro qualcuno aggiunge un `await` dentro senza controllare il flag `cancelled` dopo di esso, si crea una race condition dove si fa setState su un componente già smontato.

**Dove**  
`src/hooks/useImpostazioni.js` — il callback dell'`onSnapshot`

---

**Prompt Cursor #5**

```
In `src/hooks/useImpostazioni.js`, il callback passato a `onSnapshot` è dichiarato `async` 
ma non usa nessun `await`. 

Rimuovi la keyword `async` dal callback di `onSnapshot`:
  cambia: async (snap) => {
  in:     (snap) => {

NON toccare nessun'altra parte del file.
```

---

## BUG 6 — MEDIO: Race condition in `closeEventoForzato` — scrittura parziale senza rollback

**Il problema**  
In `eventiService.js`, `closeEventoForzato` esegue prima `Promise.all(closeMissioni)` e poi `patchEvento(...)`. Se la seconda operazione fallisce (es. timeout Firestore), le missioni sono già state chiuse ma l'evento resta aperto — stato inconsistente nel database che può bloccare funzionalità.

**Dove**  
`src/services/eventiService.js` — funzione `closeEventoForzato`

---

**Prompt Cursor #6**

```
In `src/services/eventiService.js`, la funzione `closeEventoForzato` ha una potenziale 
inconsistenza: chiude le missioni e poi l'evento in due operazioni separate. Se la seconda fallisce, 
le missioni risultano chiuse ma l'evento rimane aperto.

Avvolgi entrambe le operazioni (Promise.all e patchEvento) in un unico try/catch e rilancia l'errore 
con un messaggio chiaro:

  try {
    await Promise.all(closeMissioni);
    await patchEvento(manifestationId, eventoDocId, { ... });
  } catch (err) {
    throw new Error(
      'Chiusura evento parzialmente fallita: alcune missioni potrebbero essere già chiuse. ' +
      'Riprova o verifica manualmente lo stato delle missioni. Dettaglio: ' + err.message
    );
  }

NON cambiare la logica esistente dentro le due operazioni. NON rinominare variabili.
```

---

## BUG 7 — MEDIO: Full collection scan in `tryAutoCloseEvento` — scarica TUTTI i pazienti

**Il problema**  
In `eventoAutoCloseService.js`, `tryAutoCloseEvento` fa `getDocs(collection(db, ...pazientiPath(...)))` scaricando TUTTI i pazienti della manifestazione senza filtri. Con molti pazienti questo diventa lento e costoso (letture Firestore a pagamento). Lo stesso problema esiste in `deleteRecordiCollegati` (eventiService) e `deleteMissione` (missioniService).

**Dove**  
- `src/services/eventoAutoCloseService.js` — funzione `tryAutoCloseEvento`
- `src/services/eventiService.js` — funzione `deleteRecordiCollegati`  
- `src/services/missioniService.js` — funzione `deleteMissione`

---

**Prompt Cursor #7**

```
In `src/services/eventoAutoCloseService.js`, la funzione `tryAutoCloseEvento` scarica TUTTI 
i pazienti con `getDocs(collection(db, ...pazientiPath(manifestationId)))` senza filtri.

Sostituisci questa lettura non filtrata con due query parallele filtrate per evento:
  const [pazByUid, pazByDisplay] = await Promise.all([
    eventoRef.idUnivoco
      ? getDocs(query(collection(db, ...pazientiPath(manifestationId)), where('eventoIdUnivoco', '==', eventoRef.idUnivoco)))
      : Promise.resolve({ docs: [] }),
    eventoRef.idEvento
      ? getDocs(query(collection(db, ...pazientiPath(manifestationId)), where('eventoCorrelato', '==', eventoRef.idEvento)))
      : Promise.resolve({ docs: [] }),
  ]);
  const pazientiById = new Map();
  for (const snap of [pazByUid, pazByDisplay]) {
    for (const d of snap.docs) pazientiById.set(d.id, { _docId: d.id, ...d.data() });
  }
  const pazienti = [...pazientiById.values()];

Aggiungi `query` e `where` agli import di firebase/firestore se non già presenti.
NON cambiare nient'altro nella funzione.
```

---

## BUG 8 — BASSO: `deleteEvento` non ha feedback di errore all'utente

**Il problema**  
In `EventoScheda.jsx`, il pulsante "Elimina evento" non mostra nessun loading state durante l'operazione (che può essere lenta perché elimina tutte le missioni e tutti i pazienti collegati in cascata). Se l'utente clicca di nuovo, rischia un doppio click.

**Dove**  
`src/components/eventi/EventoScheda.jsx` — il onClick di "Elimina evento"

---

**Prompt Cursor #8**

```
In `src/components/eventi/EventoScheda.jsx`, il pulsante "Elimina evento" non ha protezione 
contro il doppio click durante l'operazione async.

Aggiungi un state locale `const [deletingEvento, setDeletingEvento] = useState(false)` 
(già usando useState che è già importato).

Modifica l'onClick del pulsante "Elimina evento" così:
- Metti `setDeletingEvento(true)` prima di `await deleteEvento(...)`
- Metti `setDeletingEvento(false)` nel finally
- Disabilita il pulsante con `disabled={deletingEvento}`
- Cambia il testo a `deletingEvento ? 'Eliminazione...' : 'Elimina evento'`

NON toccare nessun'altra parte del file.
```

---

## Ordine consigliato

1. Bug 1 (changeStatoMissione + deleteEvento — EventoScheda)
2. Bug 2 (MissioneScheda async handlers)
3. Bug 3 (reportError in ManifestazioneDataContext)
4. Bug 5 (async inutile in useImpostazioni — piccolo, rischio zero)
5. Bug 6 (closeEventoForzato race condition)
6. Bug 7 (full collection scan — solo dopo aver testato tutto il resto)
7. Bug 4 (useManifestationId — richiede verifica propagazione prima di applicare)
8. Bug 8 (loading state deleteEvento — cosmetic)

> **Regola d'oro**: dopo ogni prompt Cursor, testa l'azione corrispondente manualmente (cambia stato missione, elimina evento, ecc.) prima di passare al prompt successivo.
