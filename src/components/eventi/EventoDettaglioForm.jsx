import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { dettagliPerTipoEvento } from '../../lib/impostazioniNormalize';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { FormField, inputClass, selectClass } from '../ui/FormField';

export function EventoDettaglioForm({ values, onPatch, onCommitLocation, readOnlyId }) {
  const { impostazioni, loading } = useImpostazioni();

  if (loading) return null;

  const tipo = values.tipoEvento ?? impostazioni.tipiEvento[0] ?? '';
  const opzioniDettaglio = dettagliPerTipoEvento(impostazioni, tipo);

  const onTipoChange = (nuovoTipo) => {
    const opzioni = dettagliPerTipoEvento(impostazioni, nuovoTipo);
    const dettaglioOk = opzioni.includes(values.dettaglioEvento);
    onPatch({
      tipoEvento: nuovoTipo,
      dettaglioEvento: dettaglioOk ? values.dettaglioEvento : '',
    });
  };

  const colori = DEFAULT_IMPOSTAZIONI.coloriEvento;
  const coloreAttivo = values.colore ?? 'Bianco';

  return (
    <div className="space-y-4">
      {readOnlyId && (
        <FormField label="ID evento">
          <p className="font-mono text-lg font-bold text-sky-700">{readOnlyId}</p>
        </FormField>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Tipo evento">
          <select
            className={selectClass}
            value={tipo}
            onChange={(e) => onTipoChange(e.target.value)}
          >
            {impostazioni.tipiEvento.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Dettaglio evento">
          {opzioniDettaglio.length > 0 ? (
            <select
              className={selectClass}
              value={values.dettaglioEvento ?? ''}
              onChange={(e) => onPatch({ dettaglioEvento: e.target.value })}
            >
              <option value="">—</option>
              {opzioniDettaglio.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={inputClass}
              value={values.dettaglioEvento ?? ''}
              onChange={(e) => onPatch({ dettaglioEvento: e.target.value })}
              placeholder={
                tipo ? `Nessun dettaglio configurato per «${tipo}»` : 'Seleziona un tipo evento'
              }
            />
          )}
        </FormField>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Codice colore
        </p>
        <div className="flex flex-wrap gap-2">
          {colori.map((c) => {
            const sel = coloreAttivo === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onPatch({ colore: c })}
                className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 transition ${
                  sel
                    ? 'border-sky-600 bg-sky-50 ring-2 ring-sky-400'
                    : 'border-slate-200 bg-white hover:border-slate-400'
                }`}
              >
                <ColoreIndicator colore={c} size="lg" />
                <span className="text-[10px] font-bold uppercase text-slate-700">{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      <LuogoFisicoField
        value={values.luogo_fisico}
        onChange={(luogo_fisico) => onPatch({ luogo_fisico })}
      />

      <AddressPicker
        indirizzo={values.indirizzo}
        coordinate={values.coordinate}
        onCommit={onCommitLocation}
      />

      <FormField label="Note evento">
        <textarea
          className={inputClass}
          rows={2}
          value={values.noteEvento ?? ''}
          onChange={(e) => onPatch({ noteEvento: e.target.value })}
        />
      </FormField>
    </div>
  );
}
