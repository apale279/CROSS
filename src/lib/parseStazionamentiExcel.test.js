import { describe, expect, it } from 'vitest';
import {
  parseCoordinateCell,
  parseStazionamentiSheet,
} from './parseStazionamentiExcel';

describe('parseStazionamentiExcel', () => {
  it('parsa coordinate lat,lng', () => {
    expect(parseCoordinateCell('45.861354, 9.400537')).toEqual({
      lat: 45.861354,
      lng: 9.400537,
    });
  });

  it('legge righe dopo intestazione', () => {
    const entries = parseStazionamentiSheet([
      ['STAZIONAMENTO', 'INDIRIZZO', 'COORDINATE', 'NOTE', 'TIPO STAZIONAMENTO'],
      ['LECCO CRI_LC', 'Via Rimembranza 9', '45.86, 9.40', 'nota', 'AREU'],
      ['', '', '', '', ''],
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].nome).toBe('LECCO CRI_LC');
    expect(entries[0].tipo_stazionamento).toBe('AREU');
    expect(entries[0].note).toBe('nota');
  });
});
