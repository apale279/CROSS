import { APP_VERSION } from '../../version';

/** Etichetta versione (angolo in alto a sinistra nelle shell principali). */
export function AppVersionBadge({ className = '' }) {
  return (
    <span
      className={`shrink-0 select-none rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none tracking-wide text-slate-600 ${className}`}
      title="Versione CROSS"
    >
      {APP_VERSION}
    </span>
  );
}
