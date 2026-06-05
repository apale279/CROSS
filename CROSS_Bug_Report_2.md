# CROSS — Bug Report #2
*Analisi approfondita: flussi PMA, diario, eccezioni missione, auth, alert*
*Giugno 2026*

---

## Come usare questo documento

Stesso schema del Report #1: ogni bug ha la spiegazione in italiano operativo e il prompt Cursor da incollare. Applica un fix alla volta, testa, poi commit git.

---

## BUG A — BASSO: Flag-down lascia evento figlio orfano (recuperabile manualmente)

**Cos'è operativamente**
Il flag-down è quando un mezzo in missione intercetta un nuovo intervento lungo la strada. L'app fa tre cose in sequenza: 1) annulla la missione originale, 2) crea un nuovo evento figlio, 3) crea una nuova missione sul figlio. Se la rete cade dopo il punto 2 ma prima del 3, rimane in dashboard un evento figlio vuoto senza missioni.

**Impatto reale:** basso — l'evento può essere eliminato manualmente con "Elimina evento". Il rischio operativo è solo confusione in dashboard se qualcuno lo vede senza sapere cos'è.

**Fix scelto:** quando il flag-down fallisce a metà, mostrare all'operatore un messaggio chiaro che spiega cosa è successo e cosa fare, invece di un errore generico.

**Dove**
`src/services/missioniEccezioniService.js` — funzione `eseguiFlagDownMissione`, blocco catch

**Prompt Cursor A**

```
In `src/services/missioniEccezioniService.js`, nella funzione `eseguiFlagDownMissione`,
se createMissione fallisce dopo che createEvento ha già creato l'evento figlio,
il messaggio di errore che arriva all'operatore è generico e non spiega cosa fare.

Modifica il blocco catch così: se createEvento è andato a buon fine (cioè la
variabile { idEvento, idUnivoco } esiste già) ma createMissione fallisce,
arricchisci il messaggio di errore con istruzioni operative:

  } catch (err) {
    if (annullata) {
      try {
        await revertAnnullamentoMissione(manifestationId, missione, rollback);
      } catch (revertErr) {
        console.error('[flag-down rollback]', revertErr);
        const base = err instanceof Error ? err.message : String(err);
        throw new Error(
          `${base} Inoltre il ripristino della missione precedente non è riuscito: ` +
          'controlla manualmente evento e mezzo.'
        );
      }
    }
    // Se l'evento figlio era già stato creato, segnalalo chiaramente
    const base = err instanceof Error ? err.message : String(err);
    const hint = eventoFiglioCreato
      ? ` Un evento figlio (${idEvento ?? 'nuovo'}) è stato creato ma non ha una missione: ` +
        'aprilo in dashboard e clicca "Elimina evento" per ripulire, poi riprova il flag-down.'
      : '';
    throw new Error(base + hint);
  }

Per fare questo, dichiara `let eventoFiglioCreato = false` e `let idEvento = null`
prima del try, e impostali subito dopo createEvento:
  eventoFiglioCreato = true;
  idEvento = risultatoCreateEvento.idEvento;

NON modificare il rollback della missione. NON toccare eseguiDirottamentoMissione.
```

---

## BUG B — IMPORTANTE: Connessione live valutazioni interrotta senza avviso visibile

**Cos'è operativamente**
La scheda paziente mantiene una connessione viva con il database che aggiorna automaticamente le valutazioni MSB/MSA quando un altro operatore le modifica. Se questa connessione si interrompe (rete instabile, sessione scaduta), la scheda rimane ferma sull'ultima versione senza nessun avviso: l'operatore vede i dati come se fossero aggiornati, ma non lo sono più. Il rischio clinico è prendere decisioni su valutazioni parametri vitali che nel frattempo sono cambiate.

**Fix scelto:** quando la connessione si interrompe, mostrare un banner ben visibile nella scheda: *"Aggiornamento valutazioni non disponibile — i dati potrebbero non essere aggiornati. Chiudi e riapri la scheda per ripristinare."*

**Dove**
`src/components/pazienti/PazienteScheda.jsx` — secondo `useEffect` con `onSnapshot` (intorno a riga 258)

**Prompt Cursor B**

```
In `src/components/pazienti/PazienteScheda.jsx`, il secondo onSnapshot (quello
sulla sottocollezione valutazioniSoccorso, circa riga 258) non ha un error handler:

  const unsub = onSnapshot(vcol, (snap) => {
    const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    setValuationRows(normalizeValutazioniSoccorso(raw));
  });

Se questa connessione si interrompe, l'operatore non lo sa e potrebbe leggere
valutazioni cliniche non aggiornate senza accorgersene.

Aggiungi un error handler che mostra un avviso ben visibile:

  const unsub = onSnapshot(
    vcol,
    (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setValuationRows(normalizeValutazioniSoccorso(raw));
    },
    (err) => {
      console.error('[PazienteScheda] Connessione valutazioni interrotta:', err);
      snapshotError.show(
        'Aggiornamento valutazioni non disponibile — i dati potrebbero non essere aggiornati. ' +
        'Chiudi e riapri la scheda per ripristinare.'
      );
    },
  );

`snapshotError` è già definito sopra nello stesso componente ed è già usato
per errori simili sul documento principale. NON toccare altro.
```

---

## BUG C — IMPORTANTE: Scheda clinica PMA può risultare vuota dopo presa in carico

**Cos'è operativamente**
Quando un operatore PMA preme "Prendi in carico", l'app aggiorna lo stato del paziente e poi crea la scheda clinica vuota pronta per essere compilata. Se la rete cade tra le due operazioni, il paziente compare come "in carico" ma la scheda clinica non esiste — l'operatore non riesce a compilarla e non capisce perché.

**Fix scelto (tua idea):** aggiungere un pulsante **"Inizializza cartella clinica"** che appare solo quando il paziente è in carico ma la scheda è assente. L'operatore lo vede, capisce cosa fare, lo preme — problema risolto senza dover ricaricare la pagina.

**Dove — due file**
- `src/services/pmaStatoService.js` — funzione `prendiInCaricoPma` (backend)
- Il componente che mostra il paziente in carico nel desk PMA (cerca dove viene mostrato il paziente con stato IN_CARICO — probabilmente `PmaInCaricoCard.jsx` o `PmaDeskPage.jsx`)

**Prompt Cursor C**

```
Devo risolvere un caso in cui un paziente PMA risulta "in carico" ma la sua
scheda clinica (campo pmaScheda sul documento Firestore) è assente o vuota,
perché la rete è caduta durante la presa in carico.

PARTE 1 — Backend (pmaStatoService.js):
In `src/services/pmaStatoService.js`, funzione `prendiInCaricoPma`, la chiamata
`initPmaSchedaIfMissing` avviene fuori dalla transazione. Se fallisce, non deve
bloccare nulla — avvolgila in try/catch con solo console.warn:

  try {
    await initPmaSchedaIfMissing(manifestationId, docId, null);
  } catch (err) {
    console.warn('[prendiInCaricoPma] initPmaScheda non riuscito:', err);
    // L'operatore potrà inizializzarla manualmente dal pulsante in UI
  }

PARTE 2 — UI (individua il file corretto):
Cerca il componente che mostra il paziente con stato statoPzPma = 'in carico'
nel desk PMA (probabilmente PmaInCaricoCard.jsx o una sezione di PmaDeskPage.jsx).

In quel componente, aggiungi un pulsante "Inizializza cartella clinica" che:
- Appare SOLO se il paziente ha statoPzPma = 'in carico' E il campo pmaScheda
  è null, undefined o un oggetto vuoto {}
- Al click chiama initPmaSchedaIfMissing(manifestationId, paziente._docId, null)
  (importala da pma/lib/pazientePmaPatch.js)
- Mentre sta lavorando mostra "Inizializzazione..." e disabilita il pulsante
- In caso di errore mostra alert con il messaggio
- Scompare automaticamente quando pmaScheda viene creata (grazie al listener
  real-time già attivo sulla pagina)

Il testo del pulsante: "Inizializza cartella clinica"
Posizionamento: vicino al nome del paziente, ben visibile, colore arancione
(attenzione, non pericolo).

NON modificare il flusso normale di presa in carico. NON toccare altri componenti.
Mostrami prima quale file hai identificato come componente corretto prima di modificarlo.
```
    await initPmaSchedaIfMissing(manifestationId, docId, null);
  } catch (err) {
    console.warn('[prendiInCaricoPma] initPmaScheda non riuscito, verrà ritentato al primo salvataggio:', err);
  }

NON cambiare la transazione sopra. NON toccare setStatoPmaAutopresentato.
```

---

## BUG D — IMPORTANTE: `PmaArrivoAlertListener` apre due listener Firestore duplicati

**Cos'è operativamente**
Il componente che suona l'allarme quando un paziente arriva in tenda PMA (DIRETTO H) apre due connessioni in tempo reale proprie verso il database: una per le missioni, una per i pazienti. Ma quelle stesse connessioni sono già aperte dal sistema centrale (`ManifestazioneDataContext`). Risultato: ogni volta che un operatore PMA è connesso, il database riceve il doppio delle richieste di dati in tempo reale — costi Firestore raddoppiati e maggiore traffico di rete.

**Dove**
`src/components/pma/PmaArrivoAlertListener.jsx` — `useEffect` con i due `onSnapshot`

**Prompt Cursor D**

```
In `src/components/pma/PmaArrivoAlertListener.jsx`, il componente apre due listener
Firestore propri (onSnapshot su missioniPath e pazientiPath) che duplicano quelli
già aperti da ManifestazioneDataContext.

Refactoring: passa missioni e pazienti come props invece di aprire listener propri.

1. Aggiungi due props al componente: `missioni = []` e `pazienti = []`
2. Rimuovi i due useEffect con onSnapshot e le relative importazioni firebase
   (collection, onSnapshot, db, missioniPath, pazientiPath)
3. Sostituisci pazientiDocsRef.current e missioniDocsRef.current con i dati
   dalle props, adattando processMissionSnapshot.current:
   - `pazientiDocsRef.current` diventa semplicemente `pazienti`
   - `missioniDocsRef.current` diventa `missioni`
4. Il trigger dell'elaborazione avviene ora in un useEffect che dipende da
   `[missioni, pazienti, listenEnabled]` invece dei listener separati.

Dove viene usato PmaArrivoAlertListener (cerca nei file JSX dove è importato),
passa le props missioni e pazienti dal ManifestazioneDataContext.

Mostrami prima l'elenco completo dei file da modificare prima di procedere.
```

---

## BUG E — MEDIO: `SessionRevocationGuard` — errore silenzioso se `ensureUserSessionToken` fallisce

**Cos'è operativamente**
Il guard che disconnette automaticamente l'utente se la sua sessione viene revocata dall'amministratore usa una funzione asincrona interna senza un blocco try/catch globale. Se il server non risponde quando viene chiamato per ottenere il token di sessione, l'errore sparisce nel nulla e il guard si "addormenta" senza mai attivare il listener di sicurezza. L'utente rimane loggato anche se la sessione dovrebbe essere revocata.

**Dove**
`src/components/auth/SessionRevocationGuard.jsx` — l'IIFE asincrona dentro `useEffect`

**Prompt Cursor E**

```
In `src/components/auth/SessionRevocationGuard.jsx`, la funzione asincrona interna
(void (async () => {...})()) non ha un try/catch globale. Se ensureUserSessionToken
lancia un'eccezione (timeout, errore rete, errore Firebase), l'errore viene ignorato
e il listener onSnapshot non viene mai avviato.

Avvolgi l'intero corpo della funzione asincrona in try/catch:

  void (async () => {
    try {
      // ... tutto il codice esistente ...
    } catch (err) {
      console.warn('[SessionRevocationGuard] Inizializzazione fallita, listener non attivo:', err);
    }
  })();

NON cambiare la logica interna, NON cambiare il flag `cancelled`.
Modifica solo aggiungendo il try/catch esterno.
```

---

## BUG F — MEDIO: `PmaPazientePage` non ha ErrorBoundary — crash blocca tutto

**Cos'è operativamente**
Le pagine principali (dashboard, eventi, kiosk) sono protette da un ErrorBoundary: se crashano, mostrano una schermata di errore contenuta invece di bloccare tutta l'app. La pagina della scheda paziente PMA (`/pma/:id/paziente/:docId`) non ha questa protezione. Se si verifica un errore imprevisto durante la visualizzazione della scheda PMA, l'intera applicazione va in crash e l'operatore deve ricaricare la pagina — perdendo potenzialmente il lavoro in corso su altri pazienti.

**Dove**
`src/App.jsx` — rotta `pma/:pmaId/paziente/:pazienteDocId`

**Prompt Cursor F**

```
In `src/App.jsx`, la rotta `pma/:pmaId/paziente/:pazienteDocId` non è protetta
da RouteErrorBoundary, a differenza delle rotte dentro DashboardLayout e KioskLayout.

Modifica la rotta per avvolgerla con RouteErrorBoundary:

  <Route
    path="pma/:pmaId/paziente/:pazienteDocId"
    element={
      <RouteErrorBoundary>
        <PmaPazientePage />
      </RouteErrorBoundary>
    }
  />

Importa RouteErrorBoundary da '../components/ui/RouteErrorFallback' se non
è già importato in App.jsx.

NON toccare nessun'altra rotta.
```

---

## BUG G — BASSO: `deleteMissione` — loop sequenziale su pazienti (lento)

**Cos'è operativamente**
Quando si elimina una missione, l'app deve scollegare tutti i pazienti collegati. Se la missione ha più pazienti, li aggiorna uno alla volta in sequenza — ogni paziente aspetta che il precedente sia stato aggiornato prima di procedere. Con 3-4 pazienti sulla stessa missione, l'eliminazione può impiegare diversi secondi invece di frazioni di secondo.

**Dove**
`src/services/missioniService.js` — funzione `deleteMissione`, il `for...await` su `linked`

**Prompt Cursor G**

```
In `src/services/missioniService.js`, nella funzione `deleteMissione`, i pazienti
collegati vengono aggiornati in sequenza con un for...await:

  for (const d of linked) {
    await patchPaziente(...);
  }

Sostituiscilo con Promise.all per eseguirli in parallelo:

  await Promise.all(
    linked
      .filter(d => !pazienteInviatoVersoPma({ ...d.data(), _docId: d.id }))
      .map(d =>
        patchPaziente(
          manifestationId,
          d.id,
          fieldsScollegaPazienteDaMissione({ ...d.data(), _docId: d.id }),
        )
      )
  );

Rimuovi il vecchio loop for...await e il filtro if separato (integrato nel filter).
NON toccare il resto della funzione.
```

---

## Ordine consigliato

1. Bug B (valutazioni soccorso — 2 righe, zero rischio)
2. Bug C (prendiInCaricoPma — try/catch attorno a una riga)
3. Bug E (SessionRevocationGuard — try/catch attorno al corpo)
4. Bug F (ErrorBoundary su PmaPazientePage — 5 righe)
5. Bug A (flag-down cleanup evento — logica rollback)
6. Bug D (PmaArrivoAlertListener — refactoring props, più complesso)
7. Bug G (Promise.all — solo dopo test scenario S6 noria)

---

## Riepilogo rispetto al Report #1

| Report | Bug | Priorità | Stato |
|--------|-----|----------|-------|
| #1 | changeStatoMissione senza try/catch | Critico | Da fare |
| #1 | MissioneScheda handler async | Critico | Da fare |
| #1 | reportError mai chiamato | Importante | Da fare |
| #1 | useManifestationId lancia su null | Importante | Da fare |
| #1 | async inutile in useImpostazioni | Medio | Da fare |
| #1 | closeEventoForzato race condition | Medio | Da fare |
| #1 | Full collection scan pazienti | Medio | Da fare |
| #2 | Flag-down senza cleanup evento | Critico | Da fare |
| #2 | Listener valutazioni senza errore | Importante | Da fare |
| #2 | prendiInCaricoPma write parziale | Importante | Da fare |
| #2 | Listener Firestore duplicati PMA | Importante | Da fare |
| #2 | SessionRevocationGuard silente | Medio | Da fare |
| #2 | PmaPazientePage senza ErrorBoundary | Medio | Da fare |
| #2 | deleteMissione loop sequenziale | Basso | Da fare |
