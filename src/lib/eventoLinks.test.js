import { describe, expect, it } from 'vitest';
import {
  compareEventiAperti,
  eventoSenzaCoperturaMissione,
  missioneCoperturaEvento,
  missioniPerEvento,
  sortEventiAperti,
} from './eventoLinks';

const evento = {
  _docId: 'ev1',
  idEvento: 'E70',
  idUnivoco: 'uuid-evento-70',
};

describe('missioniPerEvento', () => {
  it('collega per idEvento anche se eventoIdUnivoco sulla missione non coincide', () => {
    const missioni = [
      {
        _docId: 'm1',
        eventoCorrelato: 'E70',
        eventoIdUnivoco: 'uuid-vecchio-sbagliato',
        stato: 'IN POSTO',
        aperta: true,
      },
    ];
    expect(missioniPerEvento(missioni, evento)).toHaveLength(1);
  });

  it('collega per idUnivoco quando coincide', () => {
    const missioni = [
      {
        _docId: 'm1',
        eventoCorrelato: 'ALTRO',
        eventoIdUnivoco: 'uuid-evento-70',
        stato: 'IN POSTO',
        aperta: true,
      },
    ];
    expect(missioniPerEvento(missioni, evento)).toHaveLength(1);
  });
});

describe('eventoSenzaCoperturaMissione', () => {
  it('non è orfano con missione IN POSTO aperta', () => {
    const missioni = [
      {
        _docId: 'm1',
        eventoCorrelato: 'E70',
        eventoIdUnivoco: 'bad',
        stato: 'IN POSTO',
        aperta: true,
      },
    ];
    expect(eventoSenzaCoperturaMissione(missioni, evento)).toBe(false);
  });

  it('non è orfano con missione ARRIVATO H aperta (mezzo ancora legato)', () => {
    const missioni = [
      {
        _docId: 'm1',
        eventoCorrelato: 'E68',
        stato: 'ARRIVATO H',
        aperta: true,
      },
    ];
    const ev68 = { ...evento, idEvento: 'E68' };
    expect(eventoSenzaCoperturaMissione(missioni, ev68)).toBe(false);
  });

  it('è orfano senza missioni collegate', () => {
    expect(eventoSenzaCoperturaMissione([], evento)).toBe(true);
  });

  it('è orfano se tutte le missioni sono chiuse', () => {
    const missioni = [
      {
        _docId: 'm1',
        eventoCorrelato: 'E70',
        stato: 'FINE MISSIONE',
        aperta: false,
      },
    ];
    expect(eventoSenzaCoperturaMissione(missioni, evento)).toBe(true);
  });
});

describe('missioneCoperturaEvento', () => {
  it('esclude FINE MISSIONE e ANNULLATA', () => {
    expect(missioneCoperturaEvento({ aperta: true, stato: 'FINE MISSIONE' })).toBe(false);
    expect(missioneCoperturaEvento({ aperta: true, stato: 'IN POSTO' })).toBe(true);
  });
});

describe('compareEventiAperti — sempre aperto', () => {
  const ts = (ms) => ({ toMillis: () => ms });

  it('evento sempre aperto resta primo anche se operativo terminato', () => {
    const sempre = {
      stato: true,
      sempreAperto: true,
      operativoTerminato: true,
      apertura: ts(1000),
    };
    const recente = {
      stato: true,
      operativoTerminato: false,
      apertura: ts(9000),
    };
    const sorted = sortEventiAperti([recente, sempre]);
    expect(sorted[0]).toBe(sempre);
    expect(compareEventiAperti(sempre, recente)).toBeLessThan(0);
  });
});
