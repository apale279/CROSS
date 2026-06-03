import { describe, expect, it } from 'vitest';
import { shouldAutoCloseEvento } from '../utils/eventoAutoClose';
import {
  eventoSenzaCoperturaMissione,
  isEventoSempreAperto,
} from './eventoLinks';

const evento = { idEvento: 'E1', idUnivoco: 'u1' };

describe('isEventoSempreAperto', () => {
  it('true solo con flag Firestore', () => {
    expect(isEventoSempreAperto({ sempreAperto: true })).toBe(true);
    expect(isEventoSempreAperto({ operativoAutoCloseSospeso: true })).toBe(false);
  });
});

describe('evento sempre aperto — scollegato da chiusura automatica', () => {
  it('non risulta orfano senza missioni', () => {
    expect(eventoSenzaCoperturaMissione([], { ...evento, sempreAperto: true })).toBe(
      false,
    );
  });

  it('non va in operativo terminato automatico (nessuna missione)', () => {
    expect(shouldAutoCloseEvento([], [])).toBe(false);
  });

  it('con operativoAutoCloseSospeso la scheda non auto-chiude (simulazione guard)', () => {
    const ev = { sempreAperto: true, operativoAutoCloseSospeso: true };
    expect(ev.operativoAutoCloseSospeso === true).toBe(true);
    expect(isEventoSempreAperto(ev)).toBe(true);
  });
});
