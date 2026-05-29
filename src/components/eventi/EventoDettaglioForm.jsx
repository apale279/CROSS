import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { dettagliPerTipoEvento, dettagliPerTipoLuogo, listaChiamantiEvento } from '../../lib/impostazioniNormalize';
import { METEO_EVENTO } from '../../lib/eventoCampi';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { AddressPicker } from '../maps/AddressPicker';
import { LuogoFisicoField } from '../maps/LuogoFisicoField';
import { ColoreIndicator } from '../ui/ColoreIndicator';
import { FormField, inputClass, selectClass } from '../ui/FormField';
import { eventoColonnaIndirizzo } from '../../lib/eventoDisplay';

export function EventoDettaglioForm({
  values,
  onPatch,
  onCommitLocation,
  readOnlyId,
  readOnly = false,
}) {
  const { impostazioni, loading } = useImpostazioni();

  if (loading) return null;

  if (readOnly) {
    const indirizzo = values.indirizzo || eventoColonnaIndirizzo(values) || '—';
    return (
      <dl className="space-y-3 text-sm">
        {readOnlyId && (
          <div>
            <dt className="font-medium text-slate-500">ID evento</dt>
            <dd className="font-mono text-lg font-bold text-sky-700">{readOnlyId}</dd>
          </div>
        )}
        <Row label="Chiamante" value={values.chiamante || '—'} />
        <Row label="Tipo evento" value={values.tipoEvento || '—'} />
        <Row label="Dettaglio evento" value={values.dettaglioEvento || '—'} />
        <Row label="Luogo" value={values.luogo || '—'} />
        <Row label="Tipo luogo" value={values.tipoLuogo || '—'} />
        <Row label="Meteo" value={values.meteo || '—'} />
        <Row label="Colore" value={values.colore || '—'} />
        <Row label="Luogo fisico" value={values.luogo_fisico || '—'} />
        <Row label="Indirizzo" value={indirizzo} />
        <Row label="Note" value={values.noteEvento || '—'} />
      </dl>
    );
  }

  const tipo = values.tipoEvento ?? impostazioni.tipiEvento[0] ?? '';
  const opzioniDettaglio = dettagliPerTipoEvento(impostazioni, tipo);
  const luogo = values.luogo ?? impostazioni.tipiLuogo[0] ?? '';
  const opzioniTipoLuogo = dettagliPerTipoLuogo(impostazioni, luogo);

  const onTipoChange = (nuovoTipo) => {
    const opzioni = dettagliPerTipoEvento(impostazioni, nuovoTipo);
    const dettaglioOk = opzioni.includes(values.dettaglioEvento);
    onPatch({
      tipoEvento: nuovoTipo,
      dettaglioEvento: dettaglioOk ? values.dettaglioEvento : '',
    });
  };

  const onLuogoChange = (nuovoLuogo) => {
    const opzioni = dettagliPerTipoLuogo(impostazioni, nuovoLuogo);
    const tipoOk = opzioni.includes(values.tipoLuogo);
    onPatch({
      luogo: nuovoLuogo,
      tipoLuogo: tipoOk ? values.tipoLuogo : '',
    });
  };

  const colori = DEFAULT_IMPOSTAZIONI.coloriEvento;
  const coloreAttivo = values.colore ?? 'Bianco';
  const chiamanti = listaChiamantiEvento(impostazioni);

  return (
    <div className="space-y-4">
      {readOnlyId && (
        <FormField label="ID evento">
          <p className="font-mono text-lg font-bold text-sky-700">{readOnlyId}</p>
        </FormField>
      )}

      <FormField label="Chiamante">
        <select
          className={selectClass}
          value={values.chiamante ?? ''}
          onChange={(e) => onPatch({ chiamante: e.target.value })}
        >
          <option value="">—</option>
          {chiamanti.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </FormField>

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

      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Luogo">
          <select
            className={selectClass}
            value={luogo}
            onChange={(e) => onLuogoChange(e.target.value)}
          >
            <option value="">—</option>
            {(impostazioni.tipiLuogo ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Tipo luogo">
          {opzioniTipoLuogo.length > 0 ? (
            <select
              className={selectClass}
              value={values.tipoLuogo ?? ''}
              onChange={(e) => onPatch({ tipoLuogo: e.target.value })}
            >
              <option value="">—</option>
              {opzioniTipoLuogo.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={inputClass}
              value={values.tipoLuogo ?? ''}
              onChange={(e) => onPatch({ tipoLuogo: e.target.value })}
              placeholder={
                luogo ? `Nessun dettaglio configurato per «${luogo}»` : 'Seleziona un luogo'
              }
            />
          )}
        </FormField>
      </div>

      <FormField label="Meteo">
        <select
          className={selectClass}
          value={values.meteo ?? ''}
          onChange={(e) => onPatch({ meteo: e.target.value })}
        >
          <option value="">—</option>
          {METEO_EVENTO.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </FormField>

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

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="col-span-2 text-slate-900">{value}</dd>
    </div>
  );
}
