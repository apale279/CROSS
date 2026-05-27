import { describe, expect, it } from 'vitest';
import { pazienteEventoTipoDettaglio } from './eventoDisplay';

describe('pazienteEventoTipoDettaglio', () => {
  it('preferisce evento collegato', () => {
    expect(
      pazienteEventoTipoDettaglio(
        { pmaScheda: { tipo_evento: 'X', dettaglio_evento: 'Y' } },
        { tipoEvento: 'Trauma', dettaglioEvento: 'Caduta' },
      ),
    ).toEqual({ tipo: 'Trauma', dettaglio: 'Caduta' });
  });

  it('usa copia su paziente se evento assente', () => {
    expect(
      pazienteEventoTipoDettaglio({
        pmaScheda: { tipo_evento: 'Malore', dettaglio_evento: 'Sincope' },
      }),
      null,
    ).toEqual({ tipo: 'Malore', dettaglio: 'Sincope' });
  });
});
