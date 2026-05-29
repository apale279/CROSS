import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_IMPOSTAZIONI } from '../../constants';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import {
  buildDashboardPmaStazioni,
  totalePazientiPmaDashboard,
} from '../../lib/pmaDashboardCentrale';

const COLORI = DEFAULT_IMPOSTAZIONI.coloriEvento;

const CHIP_COLORE = {
  Bianco: {
    on: 'border-2 border-slate-700 bg-slate-100 text-slate-900 shadow-sm',
    off: 'border border-slate-200 bg-slate-50 text-slate-300',
  },
  Verde: {
    on: 'border-2 border-emerald-800 bg-emerald-500 text-white shadow-sm',
    off: 'border border-emerald-100 bg-emerald-50/80 text-emerald-300',
  },
  Giallo: {
    on: 'border-2 border-amber-800 bg-amber-400 text-amber-950 shadow-sm',
    off: 'border border-amber-100 bg-amber-50/80 text-amber-300',
  },
  Rosso: {
    on: 'border-2 border-red-900 bg-red-500 text-white shadow-sm',
    off: 'border border-red-100 bg-red-50/80 text-red-300',
  },
};

const SEZIONI = [
  { key: 'inArrivo', label: 'In arrivo', totalKey: 'inArrivo' },
  { key: 'inAttesa', label: 'In attesa', totalKey: 'inAttesa' },
  { key: 'inCarico', label: 'In carico', totalKey: 'inCarico' },
];

function ContatoriColore({ contatori }) {
  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-4 gap-0.5"
      role="group"
      aria-label="Contatori per codice colore"
    >
      {COLORI.map((c) => {
        const n = contatori[c] ?? 0;
        const attivo = n > 0;
        const chip = CHIP_COLORE[c] ?? CHIP_COLORE.Bianco;
        return (
          <div
            key={c}
            className={`flex h-full min-h-0 flex-col items-center justify-center rounded-md px-0.5 ${
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

const CHIP_CODICI_MINORI =
  'flex h-full min-h-0 flex-col items-center justify-center rounded-md border-2 border-black bg-white px-1 text-black';

function ContatoriCodiciMinori({ codiciMinori }) {
  const aperti = codiciMinori?.aperti ?? 0;
  const chiusi = codiciMinori?.chiusi ?? 0;

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-2 gap-0.5"
      role="group"
      aria-label="Codici minori aperti e chiusi"
    >
      <div className={CHIP_CODICI_MINORI} title={`Aperti: ${aperti}`}>
        <span className="text-[10px] font-bold uppercase leading-none">Aperti</span>
        <span
          className={`font-mono font-black leading-none tabular-nums ${
            aperti > 0 ? 'text-xl' : 'text-base text-black/50'
          }`}
        >
          {aperti}
        </span>
      </div>
      <div className={CHIP_CODICI_MINORI} title={`Chiusi: ${chiusi}`}>
        <span className="text-[10px] font-bold uppercase leading-none">Chiusi</span>
        <span
          className={`font-mono font-black leading-none tabular-nums ${
            chiusi > 0 ? 'text-xl' : 'text-base text-black/50'
          }`}
        >
          {chiusi}
        </span>
      </div>
    </div>
  );
}

function SezionePma({ label, total, children, onClick, clickable = false }) {
  const Wrapper = clickable ? 'button' : 'div';
  return (
    <Wrapper
      type={clickable ? 'button' : undefined}
      onClick={onClick}
      className={`flex min-h-0 flex-col overflow-hidden rounded border border-slate-200/80 bg-white/90 px-1.5 py-1 text-left ${
        clickable ? 'cursor-pointer transition hover:border-black hover:bg-slate-50' : ''
      }`}
    >
      <div className="mb-1 flex shrink-0 items-baseline justify-between gap-1 leading-tight">
        <span className="text-sm font-bold uppercase tracking-wide text-slate-900">{label}</span>
        <span className="font-mono text-sm font-bold text-slate-900">{total}</span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Wrapper>
  );
}

function StazionePmaCard({ row, vuota = false, onOpenCodiciMinori }) {
  const { pma, totali, codiciMinori } = row;
  const totaleCodiciMinori = (codiciMinori?.aperti ?? 0) + (codiciMinori?.chiusi ?? 0);

  const apriCodiciMinori = () => {
    onOpenCodiciMinori?.(pma);
  };

  return (
    <article
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border px-1.5 py-1 ${
        vuota
          ? 'border-slate-200 bg-slate-50/80 opacity-80'
          : 'border-violet-200 bg-violet-50/40'
      }`}
    >
      <div className="mb-1 shrink-0">
        <Link
          to={`/pma/${encodeURIComponent(pma.id)}`}
          className="block truncate text-xs font-bold uppercase leading-tight text-violet-900 hover:underline"
          title={pma.nome}
        >
          {pma.nome}
        </Link>
        <p className="font-mono text-[10px] leading-tight text-violet-700/80">
          {totali.totale} attivi
        </p>
      </div>
      <div className="grid min-h-0 flex-1 grid-rows-4 gap-0.5">
        {SEZIONI.map(({ key, label, totalKey }) => (
          <SezionePma key={key} label={label} total={totali[totalKey]}>
            <ContatoriColore contatori={row[key]} />
          </SezionePma>
        ))}
        <SezionePma
          label="Codici minori"
          total={totaleCodiciMinori}
          clickable
          onClick={apriCodiciMinori}
        >
          <ContatoriCodiciMinori codiciMinori={codiciMinori} />
        </SezionePma>
      </div>
    </article>
  );
}

export function DashboardPmaPanel({ pazienti = [], loading = false, onOpenCodiciMinori }) {
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
    return <p className="p-2 text-xs text-slate-500">Caricamento stato PMA…</p>;
  }

  if (!stazioni.length) {
    return (
      <p className="p-2 text-xs text-slate-500">
        Nessun PMA configurato in impostazioni.
      </p>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <p className="shrink-0 border-b border-violet-100 bg-violet-50/80 px-2 py-1 text-[10px] leading-tight text-violet-900">
        <span className="font-bold uppercase">Sintesi</span>
        {' · '}
        <span className="font-mono font-semibold">{totale}</span> attivi ·{' '}
        <span className="font-mono font-semibold">{conPazienti}</span>/
        <span className="font-mono font-semibold">{stazioni.length}</span> PMA
        {totale === 0 ? ' · nessun paziente in tenda' : ''}
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden p-1.5">
        {stazioni.map((row) => (
          <StazionePmaCard
            key={row.pma.id}
            row={row}
            vuota={row.totali.totale === 0}
            onOpenCodiciMinori={onOpenCodiciMinori}
          />
        ))}
      </div>
    </div>
  );
}
