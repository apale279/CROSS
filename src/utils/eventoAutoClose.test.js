import { describe, expect, it } from 'vitest';
import {
  eventoHaPazientiAperti,
  pazienteBloccaChiusuraOperativaEvento,
  shouldAutoCloseEvento,
} from './eventoAutoClose';

const missioneFine = {
  aperta: false,
  stato: 'FINE MISSIONE',
};

describe('pazienteBloccaChiusuraOperativaEvento', () => {
  it('non blocca paziente ARRIVATO H ancora in PMA (E70)', () => {
    const p = {
      aperta: false,
      stato: 'ARRIVATO H',
      esito: 'Trasporta',
      destinazionePmaId: 'pma-1',
      statoPzPma: 'in carico',
    };
    expect(pazienteBloccaChiusuraOperativaEvento(p)).toBe(false);
  });

  it('blocca paziente ancora in trasporto centrale', () => {
    const p = {
      aperta: true,
      stato: 'TRASPORTO',
      esito: 'Trasporta',
    };
    expect(pazienteBloccaChiusuraOperativaEvento(p)).toBe(true);
  });
});

describe('shouldAutoCloseEvento', () => {
  it('E70-like: missione fine + paziente in PMA → operativo terminabile', () => {
    const pazienti = [
      {
        aperta: false,
        stato: 'ARRIVATO H',
        destinazionePmaId: 'pma-1',
        statoPzPma: 'in carico',
      },
    ];
    expect(shouldAutoCloseEvento([missioneFine], pazienti)).toBe(true);
    expect(eventoHaPazientiAperti(pazienti)).toBe(false);
  });

  it('E69-like: missione fine + paziente chiuso senza PMA', () => {
    const pazienti = [{ aperta: false, stato: 'ARRIVATO H', esito: 'Trasporta' }];
    expect(shouldAutoCloseEvento([missioneFine], pazienti)).toBe(true);
  });
});
