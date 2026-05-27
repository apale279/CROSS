import { describe, expect, it } from 'vitest';
import { normalizeMezzoKey } from './mezzoMissione';
import {
  buildMezziImportPlan,
  findStazionamentoByNome,
  parseFlottaMezziSheet,
} from './parseFlottaMezziExcel';

describe('parseFlottaMezziExcel', () => {
  it('legge righe FLOTTA', () => {
    const rows = parseFlottaMezziSheet([
      ['CODICE MEZZO', 'TIPO MEZZO', 'STAZIONAMENTO'],
      ['CRI_LC_3182', 'AUTOMEDICA', '@ LECCO AFFARI'],
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].sigla).toBe('CRI_LC_3182');
    expect(rows[0].stazionamentoNome).toBe('@ LECCO AFFARI');
  });

  it('risolve stazionamento e crea tipi mancanti', () => {
    const stazionamenti = [
      { id: '1', nome: '@ LECCO AFFARI', indirizzo: 'Via X', coordinate: { lat: 1, lng: 2 } },
    ];
    expect(findStazionamentoByNome('@  LECCO   AFFARI', stazionamenti)?.nome).toBe(
      '@ LECCO AFFARI',
    );

    const plan = buildMezziImportPlan({
      rows: [{ sigla: 'NEW1', tipo: 'PPI', stazionamentoNome: '@ LECCO AFFARI' }],
      stazionamenti,
      tipiMezzo: [{ nome: 'MSB', emoji: '🚑' }],
      existingMezzi: [],
      normalizeMezzoKey,
    });

    expect(plan.tipiAggiunti).toContain('PPI');
    expect(plan.toCreate).toHaveLength(1);
    expect(plan.toCreate[0].payload.stazionamentoPredefinito).toBe(true);
    expect(plan.toCreate[0].payload.stazionamentoId).toBe('1');
    expect(plan.toCreate[0].payload.stazionamento.indirizzo).toBe('Via X');
    expect(plan.toCreate[0].payload.stazionamento.coordinate).toEqual({ lat: 1, lng: 2 });
  });
});
