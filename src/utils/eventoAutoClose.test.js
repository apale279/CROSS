import { describe, expect, it } from 'vitest';
import { TIPO_PZ } from '../lib/pmaModule';
import {
  eventoHaPazientiAperti,
  pazienteBloccaChiusuraOperativaEvento,
  shouldAutoCloseEvento,
} from './eventoAutoClose';
import { pazienteInElencoChiusi } from '../lib/pazienteStati';

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

  it('non blocca codice minore da centrale già ARRIVATO H (astanteria ancora aperta)', () => {
    const p = {
      aperta: false,
      stato: 'ARRIVATO H',
      esito: 'Trasporta',
      tipoPz: TIPO_PZ.CODICE_MINORE,
      percorsoCodiceMinore: true,
      eventoCorrelato: 'E1',
      destinazionePmaId: 'pma-1',
      statoPzPma: 'in carico',
      codiceMinore: { oraFine: null },
    };
    expect(pazienteBloccaChiusuraOperativaEvento(p)).toBe(false);
    expect(pazienteInElencoChiusi(p)).toBe(true);
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

  it('codice minore ARRIVATO H: evento terminabile con missione fine', () => {
    const pazienti = [
      {
        aperta: false,
        stato: 'ARRIVATO H',
        esito: 'Trasporta',
        tipoPz: TIPO_PZ.CODICE_MINORE,
        percorsoCodiceMinore: true,
        mezzo: 'BRAVO1',
        destinazionePmaId: 'pma-1',
        statoPzPma: 'in carico',
        codiceMinore: {},
      },
    ];
    expect(shouldAutoCloseEvento([missioneFine], pazienti)).toBe(true);
    expect(eventoHaPazientiAperti(pazienti)).toBe(false);
  });
});
