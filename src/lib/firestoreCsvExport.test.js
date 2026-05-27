import { describe, expect, it } from 'vitest';
import { escapeCsvCell, rowsToCsv } from './firestoreCsvExport';

describe('firestoreCsvExport', () => {
  it('quoting celle con virgola e newline', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('riga\n2')).toBe('"riga\n2"');
  });

  it('genera intestazione e righe', () => {
    const csv = rowsToCsv(['id', 'nome'], [{ id: '1', nome: 'Test' }]);
    expect(csv).toContain('id,nome');
    expect(csv).toContain('1,Test');
  });
});
