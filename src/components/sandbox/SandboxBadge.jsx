export function SandboxBadge({ className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border border-amber-700 bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider text-amber-950 shadow-sm ${className}`}
      title="Ambiente di prova — dati non di produzione"
      role="status"
      aria-live="polite"
    >
      Sandbox
    </span>
  );
}
