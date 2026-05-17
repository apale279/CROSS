import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Overlay espanso per liste lunghe.
 * @param {boolean} [contained] - Se true, riempie solo l'area sotto l'header dashboard (non copre ticker/note).
 */
export function FullscreenPanel({ title, subtitle, onClose, children, contained = false }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`${contained ? 'absolute' : 'fixed'} inset-0 z-[100] flex flex-col bg-white`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-panel-title"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-300 bg-slate-50 px-4 py-2">
        <div className="min-w-0">
          <h2 id="fullscreen-panel-title" className="text-sm font-bold uppercase text-slate-900">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-600">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold uppercase text-slate-800 hover:bg-slate-100"
        >
          <span className="inline-flex items-center gap-1.5">
            <X className="h-4 w-4" aria-hidden />
            Chiudi
          </span>
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
