import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter } from 'lucide-react';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { mezzoStazionamentoDashboardLabel } from '../../lib/mezzoDisplay';
import {
  MEZZO_STATO_DISPONIBILE,
  MEZZO_STATO_NON_DISPONIBILE,
} from '../../lib/mezzoStati';
import { mezzoPosizioneRealeCoordinate } from '../../lib/mezzoPosizione';
import { emojiForTipoMezzo, normalizeTipiMezzo } from '../../lib/tipiMezzo';
import { mezzoRowClass } from '../../utils/formatters';

const thClass =
  'sticky top-0 z-10 bg-slate-100/95 px-2 py-2 text-left align-top backdrop-blur';
const tdClass = 'border-t border-slate-200/80 px-3 py-2 text-sm text-slate-900';

const FILTRO_STATO_DISPONIBILE = 'disponibile';
const FILTRO_STATO_NON_DISPONIBILE = 'non_disponibile';
const FILTRO_STATO_ALTRO = 'altro';

const STATO_FILTER_OPTIONS = [
  { value: FILTRO_STATO_DISPONIBILE, label: 'Disponibile' },
  { value: FILTRO_STATO_NON_DISPONIBILE, label: 'Non disponibile' },
  { value: FILTRO_STATO_ALTRO, label: 'Altri stati' },
];

function mezzoStatoFilterBucket(mezzo) {
  const stato = mezzo?.statoMezzo ?? MEZZO_STATO_DISPONIBILE;
  if (stato === MEZZO_STATO_DISPONIBILE) return FILTRO_STATO_DISPONIBILE;
  if (stato === MEZZO_STATO_NON_DISPONIBILE) return FILTRO_STATO_NON_DISPONIBILE;
  return FILTRO_STATO_ALTRO;
}

function ColumnFilterPopover({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const active = selected.size > 0;

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const toggle = (value) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  if (!options.length) {
    return (
      <span className="text-xs font-bold uppercase text-slate-600">{label}</span>
    );
  }

  return (
    <div ref={rootRef} className="relative inline-flex max-w-full items-center gap-0.5">
      <span className="truncate text-xs font-bold uppercase text-slate-600">{label}</span>
      <button
        type="button"
        className={`inline-flex shrink-0 items-center justify-center rounded border p-0.5 shadow-sm transition ${
          active
            ? 'border-sky-500 bg-sky-100 text-sky-800'
            : 'border-slate-300 bg-white text-slate-500 hover:border-slate-400 hover:text-slate-700'
        }`}
        aria-label={`Filtra colonna ${label}`}
        aria-expanded={open}
        title={active ? `Filtro attivo (${selected.size})` : `Filtra ${label}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <Filter className="h-3 w-3" aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute left-0 top-full z-30 mt-1 max-h-52 min-w-[11rem] overflow-y-auto rounded-md border border-slate-300 bg-white p-2 shadow-lg"
          role="dialog"
          aria-label={`Filtri ${label}`}
        >
          <ul className="space-y-1">
            {options.map(({ value, label: optLabel }) => (
              <li key={value}>
                <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-xs text-slate-800 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={selected.has(value)}
                    onChange={() => toggle(value)}
                  />
                  <span className="min-w-0 leading-snug">{optLabel}</span>
                </label>
              </li>
            ))}
          </ul>
          {active ? (
            <button
              type="button"
              className="mt-2 w-full rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-sky-700 hover:bg-sky-50"
              onClick={() => onChange(new Set())}
            >
              Mostra tutti
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function StatoMezziTable({ loading, mezzi, readOnly = false, onOpenMezzo }) {
  const { impostazioni } = useImpostazioni();
  const tipiMezzo = useMemo(
    () => normalizeTipiMezzo(impostazioni.tipiMezzo ?? DEFAULT_IMPOSTAZIONI.tipiMezzo),
    [impostazioni.tipiMezzo],
  );
  const gpsTrackingEnabled = impostazioni?.telegramGpsTrackingEnabled !== false;
  const stazionamenti = impostazioni?.stazionamenti ?? [];

  const [filtroStazionamento, setFiltroStazionamento] = useState(() => new Set());
  const [filtroTipo, setFiltroTipo] = useState(() => new Set());
  const [filtroStato, setFiltroStato] = useState(() => new Set());

  const stazionamentoOptions = useMemo(() => {
    const labels = new Set();
    for (const m of mezzi ?? []) {
      const label = mezzoStazionamentoDashboardLabel(m, stazionamenti);
      if (label) labels.add(label);
    }
    return [...labels]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      .map((value) => ({ value, label: value }));
  }, [mezzi, stazionamenti]);

  const tipoOptions = useMemo(() => {
    const names = new Set(tipiMezzo.map((t) => t.nome));
    for (const m of mezzi ?? []) {
      const t = String(m?.tipo ?? '').trim();
      if (t) names.add(t);
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      .map((value) => ({ value, label: value }));
  }, [mezzi, tipiMezzo]);

  const mezziFiltrati = useMemo(() => {
    return (mezzi ?? []).filter((m) => {
      if (filtroStazionamento.size > 0) {
        const label = mezzoStazionamentoDashboardLabel(m, stazionamenti);
        if (!filtroStazionamento.has(label)) return false;
      }
      if (filtroTipo.size > 0) {
        const tipo = String(m?.tipo ?? '').trim();
        if (!filtroTipo.has(tipo)) return false;
      }
      if (filtroStato.size > 0) {
        if (!filtroStato.has(mezzoStatoFilterBucket(m))) return false;
      }
      return true;
    });
  }, [mezzi, stazionamenti, filtroStazionamento, filtroTipo, filtroStato]);

  const filtriAttivi =
    filtroStazionamento.size > 0 || filtroTipo.size > 0 || filtroStato.size > 0;
  const totale = mezzi?.length ?? 0;
  const visibili = mezziFiltrati.length;

  const azzeraFiltri = () => {
    setFiltroStazionamento(new Set());
    setFiltroTipo(new Set());
    setFiltroStato(new Set());
  };

  return (
    <div className="flex min-h-0 flex-col">
      {filtriAttivi && !loading ? (
        <p className="shrink-0 border-b border-slate-100 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">
          <span className="font-mono font-semibold">{visibili}</span> /{' '}
          <span className="font-mono font-semibold">{totale}</span> mezzi
          <button
            type="button"
            className="ml-2 font-semibold text-sky-700 hover:underline"
            onClick={azzeraFiltri}
          >
            Azzera filtri
          </button>
        </p>
      ) : null}
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={thClass} scope="col">
              <span className="text-xs font-bold uppercase text-slate-600">Sigla</span>
            </th>
            <th className={thClass} scope="col">
              <ColumnFilterPopover
                label="Stazionamento"
                options={stazionamentoOptions}
                selected={filtroStazionamento}
                onChange={setFiltroStazionamento}
              />
            </th>
            <th className={thClass} scope="col">
              <ColumnFilterPopover
                label="Tipo"
                options={tipoOptions}
                selected={filtroTipo}
                onChange={setFiltroTipo}
              />
            </th>
            <th className={thClass} scope="col">
              <ColumnFilterPopover
                label="Stato"
                options={STATO_FILTER_OPTIONS}
                selected={filtroStato}
                onChange={setFiltroStato}
              />
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={4} className={tdClass}>
                Caricamento…
              </td>
            </tr>
          )}
          {!loading && visibili === 0 && (
            <tr>
              <td colSpan={4} className={`${tdClass} text-center text-slate-500`}>
                Nessun mezzo corrisponde ai filtri.
              </td>
            </tr>
          )}
          {!loading &&
            mezziFiltrati.map((m) => {
              const sigla = m.sigla ?? m._docId;
              const stazionamento = mezzoStazionamentoDashboardLabel(m, stazionamenti);
              const interactive = Boolean(onOpenMezzo);
              return (
                <tr
                  key={sigla}
                  onClick={interactive ? () => onOpenMezzo(m) : undefined}
                  className={`${mezzoRowClass(m)} ${interactive ? 'cursor-pointer' : ''}`}
                >
                  <td className={`${tdClass} font-mono font-bold`}>
                    {sigla}
                    {gpsTrackingEnabled && mezzoPosizioneRealeCoordinate(m) ? (
                      <span className="ml-1 text-sky-600" title="Posizione reale GPS (Telegram)">
                        📍
                      </span>
                    ) : null}
                  </td>
                  <td className={`${tdClass} max-w-[12rem] text-xs text-slate-700`}>
                    {stazionamento || '—'}
                  </td>
                  <td className={tdClass}>
                    {m.tipo ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-base leading-none" aria-hidden>
                          {emojiForTipoMezzo(m.tipo, tipiMezzo)}
                        </span>
                        <span>{m.tipo}</span>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={tdClass}>
                    <span
                      className={`font-semibold ${
                        (m.statoMezzo ?? MEZZO_STATO_DISPONIBILE) === MEZZO_STATO_DISPONIBILE
                          ? 'text-emerald-800'
                          : 'text-slate-600'
                      }`}
                    >
                      {m.statoMezzo ?? MEZZO_STATO_DISPONIBILE}
                    </span>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
