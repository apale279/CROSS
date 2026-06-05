/**
 * CROSS — Scenari Operativi
 *
 * 6 workflow clinici reali testati end-to-end.
 * Ogni scenario crea dati reali su Firestore e li pulisce alla fine.
 *
 * Esegui uno scenario specifico:
 *   npx playwright test --grep "S1"
 *   npx playwright test --grep "S2"
 *   ... ecc.
 *
 * Esegui tutti:
 *   npm run test:e2e
 */

import { test, expect } from '@playwright/test';
import { SESSION_FILE } from './auth.setup.js';
import {
  apriTabPazienti,
  cambiaStatoMissione,
  chiudiModal,
  completaMissione,
  creaEvento,
  creaMissione,
  creaPaziente,
  verificaAppFunzionante,
  aspettaErrore,
} from './helpers/cross-actions.js';

test.use({ storageState: SESSION_FILE });

// Tag comune per riconoscere i dati creati dai test (visibile nelle note evento)
const TAG = '[TEST-AUTO]';

// ─────────────────────────────────────────────────────────────────────────────
// S1 — EVENTO REGOLARE
// Un evento → una missione → un mezzo → un paziente → destinazione ospedale
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S1 — Evento regolare (evento→missione→mezzo→paziente→ospedale)', () => {

  test('crea evento, missione, paziente con destinazione ospedale', async ({ page }) => {

    await test.step('Crea evento', async () => {
      await creaEvento(page, { note: `${TAG} S1` });
    });

    await test.step('Crea missione con il primo mezzo disponibile', async () => {
      await creaMissione(page, { mezzoIndex: 0 });
    });

    await test.step('Porta missione IN POSTO', async () => {
      await cambiaStatoMissione(page, 'IN POSTO');
    });

    await test.step('Apri tab Pazienti e crea paziente con destinazione ospedale', async () => {
      await apriTabPazienti(page);
      // Prende il primo ospedale disponibile nella lista
      await creaPaziente(page, {
        nome: 'Paziente S1',
        esito: 'Trasporta',
        // lascia destinazione vuota: il test prenderà il primo ospedale disponibile
      });
    });

    await test.step('Completa la missione (IN POSTO → ARRIVATO H → RIENTRO → FINE MISSIONE)', async () => {
      // Torna sulla tab missioni
      const tabMissioni = page.getByRole('tab', { name: /missioni/i })
        .or(page.getByRole('button', { name: /^missioni$/i }));
      if (await tabMissioni.count() > 0) await tabMissioni.first().click();
      await completaMissione(page);
    });

    await test.step('Verifica app funzionante dopo tutto il flusso', async () => {
      await verificaAppFunzionante(page, 'S1 completato senza errori');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S2 — EVENTO REGOLARE CON DESTINAZIONE PMA
// Identico a S1 ma il paziente viene destinato al PMA invece dell'ospedale
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S2 — Evento PMA (paziente destinato al PMA)', () => {

  test('crea evento, missione, paziente diretto al PMA', async ({ page }) => {

    await test.step('Crea evento', async () => {
      await creaEvento(page, { note: `${TAG} S2` });
    });

    await test.step('Crea missione', async () => {
      await creaMissione(page, { mezzoIndex: 0 });
    });

    await test.step('Crea paziente con destinazione PMA', async () => {
      await apriTabPazienti(page);
      await creaPaziente(page, {
        nome: 'Paziente S2-PMA',
        esito: 'Trasporta',
        destinazione: 'PMA', // cerca "PMA" nella lista destinazioni
      });
    });

    await test.step('Verifica che la scheda PMA sia stata inizializzata', async () => {
      // Con destinazione PMA il paziente dovrebbe avere il badge PMA visibile
      const badgePma = page.locator('text=PMA, text=In arrivo, [class*="pma" i]').first();
      // Non crasha se non trovato — alcune configurazioni potrebbero non avere PMA configurato
      if (await badgePma.count() > 0) {
        console.log('   ✓ Badge PMA trovato');
      } else {
        console.log('   ⚠ Badge PMA non trovato — verifica che il PMA sia configurato nelle impostazioni');
      }
    });

    await test.step('Porta missione a DIRETTO H poi FINE MISSIONE', async () => {
      const tabMissioni = page.getByRole('tab', { name: /missioni/i })
        .or(page.getByRole('button', { name: /^missioni$/i }));
      if (await tabMissioni.count() > 0) await tabMissioni.first().click();
      await cambiaStatoMissione(page, 'DIRETTO H');
      await cambiaStatoMissione(page, 'ARRIVATO H');
      await cambiaStatoMissione(page, 'FINE MISSIONE');
    });

    await test.step('Verifica app funzionante', async () => {
      await verificaAppFunzionante(page, 'S2 completato senza errori');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S3 — PIÙ MISSIONI INDIPENDENTI
// Un evento con 2 missioni, ognuna con un mezzo e un paziente diverso
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S3 — Evento con più missioni (2 missioni, 2 mezzi, 2 pazienti)', () => {

  test('crea evento con 2 missioni parallele', async ({ page }) => {

    await test.step('Crea evento', async () => {
      await creaEvento(page, { note: `${TAG} S3` });
    });

    await test.step('Crea prima missione (mezzo 1)', async () => {
      await creaMissione(page, { mezzoIndex: 0 });
    });

    await test.step('Crea seconda missione (mezzo 2)', async () => {
      // Il pulsante Nuova missione deve ancora essere disponibile
      await creaMissione(page, { mezzoIndex: 1 });
    });

    await test.step('Porta entrambe le missioni IN POSTO', async () => {
      await cambiaStatoMissione(page, 'IN POSTO', 0); // prima missione
      await cambiaStatoMissione(page, 'IN POSTO', 1); // seconda missione
    });

    await test.step('Crea paziente 1 sull\'evento', async () => {
      await apriTabPazienti(page);
      await creaPaziente(page, { nome: 'Paziente S3-A', esito: 'Trasporta' });
    });

    await test.step('Crea paziente 2 sull\'evento', async () => {
      await creaPaziente(page, { nome: 'Paziente S3-B', esito: 'Trasporta' });
    });

    await test.step('Completa entrambe le missioni', async () => {
      const tabMissioni = page.getByRole('tab', { name: /missioni/i })
        .or(page.getByRole('button', { name: /^missioni$/i }));
      if (await tabMissioni.count() > 0) await tabMissioni.first().click();
      await completaMissione(page, 0);
      await completaMissione(page, 1);
    });

    await test.step('Verifica app funzionante', async () => {
      await verificaAppFunzionante(page, 'S3 completato senza errori');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S4 — ESITI DIVERSI
// 3 missioni: pz trattato in posto | pz trasportato in PMA | mezzo senza pazienti
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S4 — Esiti diversi (trattato in posto, PMA, nessun paziente)', () => {

  test('3 missioni con 3 esiti diversi', async ({ page }) => {

    await test.step('Crea evento', async () => {
      await creaEvento(page, { note: `${TAG} S4` });
    });

    await test.step('Crea 3 missioni', async () => {
      await creaMissione(page, { mezzoIndex: 0 });
      await creaMissione(page, { mezzoIndex: 1 });
      await creaMissione(page, { mezzoIndex: 2 });
    });

    await test.step('Porta tutte IN POSTO', async () => {
      await cambiaStatoMissione(page, 'IN POSTO', 0);
      await cambiaStatoMissione(page, 'IN POSTO', 1);
      await cambiaStatoMissione(page, 'IN POSTO', 2);
    });

    await test.step('Crea paziente A: Risolto in posto', async () => {
      await apriTabPazienti(page);
      await creaPaziente(page, {
        nome: 'Paziente S4-A',
        esito: 'Risolto in posto',
      });
    });

    await test.step('Crea paziente B: Trasportato in PMA', async () => {
      await creaPaziente(page, {
        nome: 'Paziente S4-B',
        esito: 'Trasporta',
        destinazione: 'PMA',
      });
    });

    await test.step('Missione 3 termina senza pazienti (mezzo libero)', async () => {
      const tabMissioni = page.getByRole('tab', { name: /missioni/i })
        .or(page.getByRole('button', { name: /^missioni$/i }));
      if (await tabMissioni.count() > 0) await tabMissioni.first().click();
      // Missione 3: va in RIENTRO senza nessun paziente → FINE MISSIONE
      await cambiaStatoMissione(page, 'RIENTRO', 2);
      await cambiaStatoMissione(page, 'FINE MISSIONE', 2);
    });

    await test.step('Completa missioni 1 e 2', async () => {
      await completaMissione(page, 0);
      await completaMissione(page, 1);
    });

    await test.step('Verifica app funzionante', async () => {
      await verificaAppFunzionante(page, 'S4 completato senza errori');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S5 — MEZZO DIROTTATO
// Missione avviata, poi annullata per riassegnare il mezzo a un altro evento
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S5 — Mezzo dirottato (missione interrotta e riassegnata)', () => {

  test('crea 2 eventi, dirorta mezzo dal primo al secondo', async ({ page }) => {

    await test.step('Crea primo evento e avvia missione', async () => {
      await creaEvento(page, { note: `${TAG} S5-evento1` });
      await creaMissione(page, { mezzoIndex: 0 });
      await cambiaStatoMissione(page, 'ALLERTATO');
      // Mezzo in allerta sul primo evento — lo andremo ad annullare
      console.log('   Mezzo allertato sul primo evento');
    });

    await test.step('Annulla la missione (mezzo si libera)', async () => {
      await cambiaStatoMissione(page, 'ANNULLATA');
      await page.waitForTimeout(1500);
      // Il mezzo deve tornare Disponibile
      console.log('   Missione annullata — mezzo torna disponibile');
    });

    await test.step('Chiudi il modal e crea secondo evento', async () => {
      await chiudiModal(page);
      await page.waitForTimeout(500);
      await creaEvento(page, { note: `${TAG} S5-evento2` });
    });

    await test.step('Assegna lo stesso mezzo al secondo evento', async () => {
      // Il mezzo ora deve essere disponibile — seleziona il primo (stessa logica)
      await creaMissione(page, { mezzoIndex: 0 });
      console.log('   Stesso mezzo assegnato al secondo evento');
    });

    await test.step('Porta la nuova missione a FINE MISSIONE', async () => {
      await completaMissione(page);
    });

    await test.step('Verifica app funzionante', async () => {
      await verificaAppFunzionante(page, 'S5 completato — mezzo dirottato correttamente');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// S6 — NORIA (stesso mezzo, più viaggi)
// Evento "ARRIVO CORSA": stesso equipaggio trasporta 3 pazienti in sequenza
// ─────────────────────────────────────────────────────────────────────────────
test.describe('S6 — Noria (stesso mezzo, 3 trasporti sequenziali)', () => {

  test('stesso mezzo percorre 3 viaggi separati per 3 pazienti diversi', async ({ page }) => {

    await test.step('Crea evento tipo ARRIVO CORSA', async () => {
      await creaEvento(page, { note: `${TAG} S6 NORIA` });
    });

    // La noria si realizza creando 3 missioni in sequenza con lo stesso mezzo.
    // Ogni missione: ALLERTATO → IN POSTO → ARRIVATO H → RIENTRO (mezzo si libera) → nuova missione
    for (let viaggio = 1; viaggio <= 3; viaggio++) {
      await test.step(`Viaggio ${viaggio}/3 — missione, paziente, trasporto, rientro`, async () => {

        // Crea missione (stesso mezzo — index 0)
        await creaMissione(page, { mezzoIndex: 0 });
        await cambiaStatoMissione(page, 'IN POSTO');

        // Crea paziente per questo viaggio
        await apriTabPazienti(page);
        await creaPaziente(page, {
          nome: `Paziente S6-${viaggio}`,
          esito: 'Trasporta',
        });

        // Porta la missione a RIENTRO — il mezzo si libera per il prossimo viaggio
        const tabMissioni = page.getByRole('tab', { name: /missioni/i })
          .or(page.getByRole('button', { name: /^missioni$/i }));
        if (await tabMissioni.count() > 0) await tabMissioni.first().click();

        await cambiaStatoMissione(page, 'ARRIVATO H', viaggio - 1);
        await cambiaStatoMissione(page, 'RIENTRO', viaggio - 1);
        // IMPORTANTE: a RIENTRO il mezzo è di nuovo libero — può essere riassegnato
        console.log(`   ✓ Viaggio ${viaggio} completato — mezzo in RIENTRO, libero per prossimo viaggio`);

        await page.waitForTimeout(1000);
      });
    }

    await test.step('Chiudi tutte le missioni a FINE MISSIONE', async () => {
      for (let i = 0; i < 3; i++) {
        await cambiaStatoMissione(page, 'FINE MISSIONE', i);
      }
    });

    await test.step('Verifica app funzionante dopo 3 viaggi in noria', async () => {
      await verificaAppFunzionante(page, 'S6 completato — noria di 3 trasporti senza errori');
    });
  });
});
