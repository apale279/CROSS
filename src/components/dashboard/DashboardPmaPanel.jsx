import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  buildDashboardPmaStazioni,
  totalePazientiPmaDashboard,
} from '../../lib/pmaDashboardCentrale';
const COLORI = DEFAULT_IMPOSTAZIONI.coloriEvento;

/** Cella contatore: sfondo colore triage + numero grande (bianco con bordo scuro). */
const CHIP_COLORE = {
  Bianco: {
    on: 'border-2 border-slate-700 bg-slate-100 text-slate-900 shadow-sm',
    off: 'border border-slate-300 bg-slate-50 text-slate-300',
  },
  Verde: {
    on: 'border-2 border-emerald-800 bg-emerald-500 text-white shadow-sm',
    off: 'border border-emerald-200 bg-emerald-50/80 text-emerald-300',
  },
  Giallo: {
    on: 'border-2 border-amber-800 bg-amber-400 text-amber-950 shadow-sm',
    off: 'border border-amber-200 bg-amber-50/80 text-amber-300',
  },
  Rosso: {
    on: 'border-2 border-red-900 bg-red-500 text-white shadow-sm',
    off: 'border border-red-200 bg-red-50/80 text-red-300',
  },
};

const SEZIONI = [
  { key: 'inArrivo', label: 'In arrivo', totalKey: 'inArrivo' },
  { key: 'inAttesa', label: 'In attesa', totalKey: 'inAttesa' },
  { key: 'inCarico', label: 'In carico', totalKey: 'inCarico' },
];

function ContatoriColore({ contatori }) {
  return (
    <div className="grid grid-cols-4 gap-0.5" role="group" aria-label="Contatori per codice colore">
      {COLORI.map((c) => {
        const n = contatori[c] ?? 0;
        const attivo = n > 0;
        const chip = CHIP_COLORE[c] ?? CHIP_COLORE.Bianco;
        return (
          <div
            key={c}
            className={`flex min-h-[2.25rem] flex-col items-center justify-center rounded-md px-0.5 py-0.5 ${
              attivo ? chip.on : chip.off
            }`}
            title={`${c}: ${n}`}
          >
            <span
              className={`font-mono font-black leading-none tabular-nums ${
                attivo ? 'text-xl' : 'text-base'
              }`}
            >
              {n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function StazionePmaCard({ row, vuota = false }) {
  const { pma, totali, codiciMinori } = row;
  return (
    <article
      className={`rounded-lg border px-1.5 py-1.5 ${
        vuota
          ? 'border-slate-200 bg-slate-50/80 opacity-80'
          : 'border-violet-200 bg-violet-50/40'
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-1">
        <div className="min-w-0">
          <Link
            to={`/pma/${encodeURIComponent(pma.id)}`}
            className="block truncate text-xs font-bold uppercase text-violet-900 hover:underline"
            title={pma.nome}
          >
            {pma.nome}
          </Link>
          <p className="font-mono text-[10px] text-violet-700/80">{totali.totale} pazienti attivi</p>
        </div>
      </div>
      <div className="space-y-1">
        {SEZIONI.map(({ key, label, totalKey }) => (
          <div
            key={key}
            className="rounded border border-slate-200/80 bg-white/90 px-1 py-1"
          >
            <div className="mb-0.5 flex items-baseline justify-between gap-1 leading-tight">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-900">
                {label}
              </span>
              <span className="font-mono text-sm font-bold text-slate-900">{totali[totalKey]}</span>
            </div>
            <ContatoriColore contatori={row[key]} />
          </div>
        ))}
      </div>
      <div className="mt-1 rounded border border-amber-200/80 bg-amber-50/70 px-1.5 py-1 text-[10px] text-amber-950">
        <span className="font-bold uppercase">Codici minori</span>
        {' · '}
        <span className="font-mono font-bold">{codiciMinori?.aperti ?? 0}</span> aperti
        {' · '}
        <span className="font-mono font-bold">{codiciMinori?.chiusi ?? 0}</span> chiusi
      </div>
    </article>
  );
}

export function DashboardPmaPanel({ pazienti = [], loading = false }) {
  const { impostazioni } = useImpostazioni();
  const stazioni = useMemo(
    () => buildDashboardPmaStazioni(pazienti, impostazioni),
    [pazienti, impostazioni],
  );
  const totale = useMemo(() => totalePazientiPmaDashboard(stazioni), [stazioni]);
  const conPazienti = useMemo(
    () => stazioni.filter((s) => s.totali.totale > 0).length,
    [stazioni],
  );

  if (loading) {
    return <p className="p-3 text-xs text-slate-500">Caricamento stato PMA…</p>;
  }

  if (!stazioni.length) {
    return (
      <p className="p-3 text-xs text-slate-500">
        Nessun PMA configurato in impostazioni.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="shrink-0 border-b border-violet-100 bg-violet-50/80 px-2 py-1.5 text-[10px] text-violet-900">
        <span className="font-bold uppercase">Sintesi tende</span>
        {' · '}
        <span className="font-mono font-semibold">{totale}</span> pazienti attivi su{' '}
        <span className="font-mono font-semibold">{conPazienti}</span> /{' '}
        <span className="font-mono font-semibold">{stazioni.length}</span> PMA con attività
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {totale === 0 ? (
          <p className="mb-2 py-2 text-center text-xs text-slate-500">
            Nessun paziente in arrivo, in attesa o in carico.
          </p>
        ) : null}
        <div className="space-y-2">
          {stazioni.map((row) => (
            <StazionePmaCard
              key={row.pma.id}
              row={row}
              vuota={row.totali.totale === 0}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
