import { FormField, selectClass } from '../ui/FormField';

/**
 * Un solo stazionamento per mezzo, scelto dall’elenco Impostazioni.
 * Alla selezione copia indirizzo e coordinate (base operativa del mezzo).
 */
export function MezzoStazionamentoSelect({
  stazionamenti,
  valueId,
  onSelectId,
  disabled = false,
}) {
  const list = stazionamenti ?? [];
  const selected = list.find((s) => s.id === valueId) ?? null;

  if (list.length === 0) {
    return (
      <p className="text-sm text-amber-800">
        Nessuno stazionamento in Impostazioni. Aggiungili in Impostazioni → Altro → Stazionamento
        prima di assegnare i mezzi.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <FormField label="Stazionamento (sede del mezzo)">
        <select
          className={selectClass}
          value={valueId ?? ''}
          disabled={disabled}
          onChange={(e) => onSelectId(e.target.value)}
        >
          <option value="">— Seleziona stazionamento —</option>
          {list.map((st) => (
            <option key={st.id} value={st.id}>
              {st.nome}
              {st.tipo_stazionamento ? ` (${st.tipo_stazionamento})` : ''}
            </option>
          ))}
        </select>
      </FormField>
      {selected ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <p className="font-medium text-slate-800">{selected.nome}</p>
          {selected.indirizzo ? <p className="mt-1">{selected.indirizzo}</p> : null}
          {selected.coordinate ? (
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {selected.coordinate.lat}, {selected.coordinate.lng}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            Base operativa: a fine missione il mezzo è considerato in questa sede (mappa e
            disponibilità).
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Scegli uno stazionamento dall’elenco: indirizzo e coordinate verranno assegnati al mezzo.
        </p>
      )}
    </div>
  );
}
