import { MinimizeToDockButton } from '../ui/MinimizeToDockButton';

export function KioskPageHeader({ title, panelId }) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-300 bg-white px-4 py-3">
      <h1 className="text-sm font-bold uppercase tracking-wide text-slate-900">{title}</h1>
      <MinimizeToDockButton panelId={panelId} />
    </header>
  );
}
