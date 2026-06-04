import { useEffect, useMemo, useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  emptyLesioneTuple,
  LESIONE_LATI,
  lesioniVasMax,
  listaLesioniLocalizzazioni,
  listaLesioniTipologie,
  normalizeLesioni,
} from '../../lib/valutazioneLesioni';
import { btnPrimary } from '../ui/FormField';

const CELL_IN =
  'box-border w-full min-w-0 rounded border border-slate-300 px-1 py-1.5 text-sm font-medium disabled:bg-slate-100';

const sideBtn = (active) =>
  `min-h-[2rem] flex-1 rounded-md border-2 px-2 text-xs font-bold uppercase ${
    active
      ? 'border-teal-600 bg-teal-100 text-teal-900'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
  }`;

/** VAS: stato locale in modifica per digitare valori a due cifre (es. 10) senza perdere il focus. */
function VasLesioneInput({ vas, vasMax, disabled, onCommit }) {
  const [draft, setDraft] = useState(null);
  const editing = draft !== null;
  const display = editing ? draft : vas == null || vas === '' ? '' : String(vas);
  const maxLen = Math.max(1, String(vasMax).length);

  const commitDraft = (raw) => {
    const v = String(raw ?? '').trim();
    if (v === '') {
      onCommit(null);
      return;
    }
    const n = Number.parseInt(v, 10);
    if (!Number.isFinite(n)) return;
    onCommit(Math.max(0, Math.min(vasMax, n)));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      value={display}
      placeholder="—"
      maxLength={maxLen}
      className={`${CELL_IN} text-center tabular-nums`}
      onFocus={() => setDraft(vas == null ? '' : String(vas))}
      onBlur={() => {
        commitDraft(draft ?? display);
        setDraft(null);
      }}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '').slice(0, maxLen);
        setDraft(t);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitDraft(draft ?? display);
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function ValutazioneLesioniTable({ lesioni, onPatchLesioni, disabled = false }) {
  const { impostazioni } = useImpostazioni();
  const localizzazioni = useMemo(
    () => listaLesioniLocalizzazioni(impostazioni),
    [impostazioni],
  );
  const tipologie = useMemo(() => listaLesioniTipologie(impostazioni), [impostazioni]);
  const vasMax = useMemo(() => lesioniVasMax(impostazioni), [impostazioni]);
  const serverRows = useMemo(() => normalizeLesioni(lesioni, vasMax), [lesioni, vasMax]);
  const [rows, setRows] = useState(serverRows);

  useEffect(() => {
    setRows(serverRows);
  }, [serverRows]);

  const patchRow = (index, partialTuple) => {
    const next = rows.map((row, i) => {
      if (i !== index) return [...row];
      const r = [...row];
      if (partialTuple.localizzazione !== undefined) r[0] = partialTuple.localizzazione;
      if (partialTuple.lato !== undefined) r[1] = partialTuple.lato;
      if (partialTuple.tipologia !== undefined) r[2] = partialTuple.tipologia;
      if (partialTuple.vas !== undefined) r[3] = partialTuple.vas;
      return r;
    });
    setRows(next);
    onPatchLesioni(next);
  };

  const removeRow = (index) => {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    onPatchLesioni(next);
  };

  const aggiungiRiga = () => {
    const next = [...rows, emptyLesioneTuple()];
    setRows(next);
    onPatchLesioni(next);
  };

  const catalogoVuoto = localizzazioni.length === 0 && tipologie.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase text-slate-700">Lesioni</p>
        {!disabled ? (
          <button
            type="button"
            className={`${btnPrimary} inline-flex h-9 items-center justify-center px-3 text-xs`}
            onClick={aggiungiRiga}
          >
            Aggiungi lesioni
          </button>
        ) : null}
      </div>

      {catalogoVuoto && !disabled ? (
        <p className="text-xs text-amber-800">
          Configura prima le liste in Impostazioni → Evento → <strong>MSB / MSA</strong> (localizzazioni
          e tipologie), oppure compila i campi testo liberi nella riga.
        </p>
      ) : null}

      <div className="overflow-x-auto rounded border border-slate-200 [-webkit-overflow-scrolling:touch]">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              <th className="border border-slate-200 p-1">Localizzazione</th>
              <th className="border border-slate-200 p-1">SN / DX</th>
              <th className="border border-slate-200 p-1">Tipologia</th>
              <th className="border border-slate-200 p-1">VAS (0–{vasMax})</th>
              {!disabled ? (
                <th className="border border-slate-200 p-1 text-center" scope="col">
                  <span className="sr-only">Elimina</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={disabled ? 4 : 5}
                  className="border border-slate-200 p-3 text-sm text-slate-500"
                >
                  Nessuna lesione registrata. Usa «Aggiungi lesioni» per inserire una riga.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={`lesione-row-${idx}`}
                  className="border-b border-slate-200 odd:bg-white even:bg-slate-50/70"
                >
                  <td className="border border-slate-200 p-1 align-middle">
                    {localizzazioni.length > 0 ? (
                      <select
                        disabled={disabled}
                        value={row[0]}
                        onChange={(e) => patchRow(idx, { localizzazione: e.target.value })}
                        className={CELL_IN}
                      >
                        <option value="">— Seleziona —</option>
                        {localizzazioni.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                        {row[0] && !localizzazioni.includes(row[0]) ? (
                          <option value={row[0]}>{row[0]}</option>
                        ) : null}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled={disabled}
                        value={row[0]}
                        placeholder="Localizzazione"
                        className={CELL_IN}
                        onChange={(e) => patchRow(idx, { localizzazione: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="border border-slate-200 p-1 align-middle">
                    <div className="flex gap-1">
                      {LESIONE_LATI.map((lato) => (
                        <button
                          key={lato}
                          type="button"
                          disabled={disabled}
                          className={sideBtn(row[1] === lato)}
                          onClick={() =>
                            patchRow(idx, { lato: row[1] === lato ? '' : lato })
                          }
                        >
                          {lato}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="border border-slate-200 p-1 align-middle">
                    {tipologie.length > 0 ? (
                      <select
                        disabled={disabled}
                        value={row[2]}
                        onChange={(e) => patchRow(idx, { tipologia: e.target.value })}
                        className={CELL_IN}
                      >
                        <option value="">— Seleziona —</option>
                        {tipologie.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                        {row[2] && !tipologie.includes(row[2]) ? (
                          <option value={row[2]}>{row[2]}</option>
                        ) : null}
                      </select>
                    ) : (
                      <input
                        type="text"
                        disabled={disabled}
                        value={row[2]}
                        placeholder="Tipologia"
                        className={CELL_IN}
                        onChange={(e) => patchRow(idx, { tipologia: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="border border-slate-200 p-1 align-middle">
                    <VasLesioneInput
                      vas={row[3]}
                      vasMax={vasMax}
                      disabled={disabled}
                      onCommit={(vas) => patchRow(idx, { vas })}
                    />
                  </td>
                  {!disabled ? (
                    <td className="border border-slate-200 p-1 text-center align-middle">
                      <button
                        type="button"
                        title="Rimuovi lesione"
                        aria-label="Rimuovi lesione"
                        onClick={() => removeRow(idx)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M9 3h6M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
