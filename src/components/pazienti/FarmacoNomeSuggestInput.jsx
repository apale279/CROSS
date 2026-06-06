import { useMemo, useState } from 'react';
import { filterCatalogByNomePrefix } from '@pma/types/farmaciCatalogo';

/**
 * Campo testo libero con suggerimenti nome dal catalogo PMA (solo nome, nessun vincolo).
 */
export function FarmacoNomeSuggestInput({
  catalog,
  value,
  onChange,
  onBlur,
  inputClassName = '',
  placeholder = 'Farmaco…',
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(
    () => filterCatalogByNomePrefix(catalog, value, 10),
    [catalog, value],
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
