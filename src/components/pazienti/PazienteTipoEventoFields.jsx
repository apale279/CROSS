import { dettagliPerTipoEvento } from '../../lib/impostazioniNormalize';
import { FormField, inputClass, selectClass } from '../ui/FormField';

/** Tipo / dettaglio evento (stessi campi dell’evento operativo). */
export function PazienteTipoEventoFields({
  impostazioni,
  tipoEvento,
  dettaglioEvento,
  onChange,
  onDettaglioBlur,
  readOnly = false,
  required = false,
}) {
  const tipi = impostazioni?.tipiEvento ?? [];
  const tipo = tipoEvento ?? tipi[0] ?? '';
  const opzioni = dettagliPerTipoEvento(impostazioni, tipo);

  const onTipoChange = (nuovoTipo) => {
    const opts = dettagliPerTipoEvento(impostazioni, nuovoTipo);
    const dettaglioOk = opts.includes(dettaglioEvento);
    onChange?.({
      tipoEvento: nuovoTipo,
      dettaglioEvento: dettaglioOk ? dettaglioEvento : opts[0] ?? '',
    });
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FormField label={required ? 'Tipo evento *' : 'Tipo evento'}>
        <select
          className={selectClass}
          value={tipoEvento ?? ''}
          disabled={readOnly}
          onChange={(e) => onTipoChange(e.target.value)}
        >
          <option value="">—</option>
          {tipi.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label={required ? 'Dettaglio evento *' : 'Dettaglio evento'}>
        {opzioni.length > 0 ? (
          <select
            className={selectClass}
            value={dettaglioEvento ?? ''}
            disabled={readOnly}
            onChange={(e) => onChange?.({ dettaglioEvento: e.target.value })}
          >
            <option value="">—</option>
            {opzioni.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <input
            className={inputClass}
            value={dettaglioEvento ?? ''}
            disabled={readOnly}
            onChange={(e) => onChange?.({ dettaglioEvento: e.target.value })}
            onBlur={(e) => onDettaglioBlur?.(e.target.value)}
          />
        )}
      </FormField>
    </div>
  );
}
