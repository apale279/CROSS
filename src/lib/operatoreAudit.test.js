import { describe, expect, it } from 'vitest';
import {
  mergeOperatoreCreatoPayload,
  operatoreCreatoFields,
  operatoreCreatoLine,
  operatoreUserLabel,
  stripOperatoreCreatoFromPatch,
} from './operatoreAudit.js';

describe('operatoreAudit', () => {
  it('operatoreCreatoFields richiede uid', () => {
    expect(operatoreCreatoFields(null, { nomeUtente: 'a.b' })).toEqual({});
    expect(
      operatoreCreatoFields({ uid: 'u1' }, { nomeUtente: 'a.b', nome: 'A B' }),
    ).toEqual({
      creatoDaUid: 'u1',
      creatoDaNomeUtente: 'a.b',
      creatoDaNome: 'A B',
    });
  });

  it('mergeOperatoreCreatoPayload ignora chiavi non audit', () => {
    expect(
      mergeOperatoreCreatoPayload({
        tipoEvento: 'Incendio',
        creatoDaUid: 'u1',
        creatoDaNomeUtente: 'op',
      }),
    ).toEqual({
      creatoDaUid: 'u1',
      creatoDaNomeUtente: 'op',
    });
  });

  it('stripOperatoreCreatoFromPatch rimuove solo campi audit', () => {
    const input = {
      colore: 'Rosso',
      creatoDaUid: 'altro',
      creatoDaNomeUtente: 'nuovo',
      noteEvento: 'x',
    };
    expect(stripOperatoreCreatoFromPatch(input)).toEqual({
      colore: 'Rosso',
      noteEvento: 'x',
    });
    expect(input.creatoDaUid).toBe('altro');
  });

  it('operatoreCreatoLine fa fallback su sola apertura', () => {
    expect(operatoreCreatoLine({ apertura: new Date('2026-05-28T10:00:00') })).toMatch(
      /28\/05\/2026/,
    );
    expect(
      operatoreCreatoLine({
        creatoDaNomeUtente: 'op',
        apertura: new Date('2026-05-28T10:00:00'),
      }),
    ).toMatch(/Creato da @op/);
  });

  it('operatoreUserLabel preferisce nomeUtente', () => {
    expect(operatoreUserLabel({ creatoDaNomeUtente: 'op', creatoDaNome: 'Nome' })).toBe('@op');
  });
});
