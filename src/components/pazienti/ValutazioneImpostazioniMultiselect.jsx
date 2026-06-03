import { useMemo } from 'react';

/**
 * Multiselect da catalogo impostazioni (array di nomi).
 * onChange riceve l'array completo selezionato; il parent fa patch granulare (es. solo presidi).
 */
export function ValutazioneImpostazioniMultiselect({
  label,
  options = [],
  selected = [],
  onChange,
  disabled = false,
}) {
  const sel = useMemo(() => new Set((selected ?? []).map((s) => String(s).trim()).filter(Boolean)), [selected]);
  const orderedSelected = useMemo(
    () => options.filter((o) => sel.has(o)),
    [options, sel],
  );

  const toggle = (item) => {
    if (disabled) return;
    const next = new Set(sel);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    onChange(options.filter((o) => next.has(o)));
  };

  if (options.length === 0) {
    return (
      <div>
        <p className="text-xs font-bold uppercase text-slate-700">{label}</p>
        <p className="mt-1 text-xs text-slate-500">
          Nessuna voce configurata in Impostazioni → Evento → MSB / MSA.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase text-slate-700">{label}</p>
      <details className="max-w-xl rounded-lg border border-slate-300 bg-white shadow-sm [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
          <span>
            {sel.size === 0
              ? 'Nessuna selezione — clicca per scegliere'
              : sel.size === 1
                ? '1 voce selezionata'
                : `${sel.size} voci selezionate`}
          </span>
          <span className="shrink-0 text-slate-400" aria-hidden>
            ▼
          </span>
        </summary>
        <div className="max-h-52 overflow-y-auto border-t border-slate-200 p-2">
          {options.map((item) => (
            <label
              key={item}
              className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                checked={sel.has(item)}
                disabled={disabled}
                onChange={() => toggle(item)}
              />
              <span className="min-w-0 leading-snug text-slate-800">{item}</span>
            </label>
          ))}
        </div>
      </details>
      {orderedSelected.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={`${label} selezionate`}>
          {orderedSelected.map((item) => (
            <li
              key={item}
              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
