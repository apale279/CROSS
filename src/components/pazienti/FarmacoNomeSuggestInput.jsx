import { useEffect, useMemo, useState } from 'react';
import { filterCatalogByNomePrefix } from '@pma/types/farmaciCatalogo';

const SUGGEST_DEBOUNCE_MS = 280;

/**
 * Campo testo libero con suggerimenti nome dal catalogo PMA (solo nome, nessun vincolo).
 * I suggerimenti sono debounced per non interferire con la digitazione.
 */
export function FarmacoNomeSuggestInput({
  catalog,
  value,
  onChange,
  onPickEntry,
  onBlur,
  inputClassName = '',
  placeholder = 'Farmaco…',
}) {
  const [focused, setFocused] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(value), SUGGEST_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);

  const suggestions = useMemo(
    () => (focused ? filterCatalogByNomePrefix(catalog, debouncedQuery, 10) : []),
    [catalog, debouncedQuery, focused],
  );

  return (
    <label className="relative block min-w-0 flex-1">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          window.setTimeout(() => setFocused(false), 150);
          onBlur?.();
        }}
        autoComplete="off"
        className={inputClassName ? `${inputClassName} pma-mobile-input` : 'pma-mobile-input'}
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
                  onChange(entry.nome);
                  onPickEntry?.(entry);
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
