import { AlertTriangle } from 'lucide-react';

export function PanelAlertIcon({ variant = 'amber', title, className = '' }) {
  const color = variant === 'red' ? 'text-red-600' : 'text-amber-600';
  return (
    <span
      className={`inline-flex shrink-0 ${color} ${className}`}
      title={title}
      role="img"
      aria-label={title}
    >
      <AlertTriangle className="alert-blink h-5 w-5 fill-current stroke-[2.5]" />
    </span>
  );
}
