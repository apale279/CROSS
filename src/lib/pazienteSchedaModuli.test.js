import { describe, expect, it } from 'vitest';
import { moduliSchedaPazienteForCreate } from './pazienteSchedaModuli';

describe('moduliSchedaPazienteForCreate', () => {
  it('abilita esito e valutazioni per nuovo paziente da evento', () => {
    const m = moduliSchedaPazienteForCreate({ idEvento: 'E1', idUnivoco: 'u1' });
    expect(m.esitoTrasporto).toBe(true);
    expect(m.valutazioniSoccorso).toBe(true);
    expect(m.originePma).toBe(false);
  });
});
