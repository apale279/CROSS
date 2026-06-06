import { useMemo, useState } from 'react';
import { filterCatalogByNomePrefix } from '@pma/types/farmaciCatalogo';

/**
 * Campo testo libero con suggerimenti nome dal catalogo PMA (solo nome, nessun vincolo).
 */
export function FarmacoNomeSuggestInput({
  catalog,
  value,
  onChange,
  inputClassName = '',
  placeholder = 'Farmaco…',
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;
  const server = value ?? '';
  const display = editing ? draft : server;
  const suggestions = useMemo(
    () => filterCatalogByNomePrefix(catalog, display, 10),
    [catalog, display],
  );

  const commit = (next) => {
    if (next !== server) onChange(next);
  };

  return (
    <label className="relative block min-w-0 flex-1">
      <input
        type="text"
        value={display}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={() => {
          setFocused(true);
          setDraft(server);
        }}
        onBlur={() => {
          const next = draft ?? display;
          setDraft(null);
          commit(next);
          window.setTimeout(() => setFocused(false), 150);
        }}
        autoComplete="off"
        className={inputClassName}
        placeholder={placeholder}
      />
      {focused && suggestions.length > 0 ? (
        <ul
          className="absolute inset-x-0 z-20 mt-1 max-h-48 overflow-x-hidden overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-slate-800 hover:bg-violet-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setDraft(null);
                  onChange(entry.nome);
                  setFocused(false);
                }}
              >
                {entry.nome}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </label>
  );
}
