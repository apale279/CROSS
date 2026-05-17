import { ExternalLink } from 'lucide-react';

/**
 * Apre il pannello in finestra separata (monitor esterno).
 * @param {string} panelId - operativo | mezzi | mappa
 * @param {(panelId: string) => void} onPopOut
 */
export function PopOutButton({ panelId, onPopOut }) {
  return (
    <button
      type="button"
      onClick={() => onPopOut(panelId)}
      className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-sky-800"
      title="Sposta su monitor esterno (sola lettura). Chiudi la finestra per ripristinare qui."
      aria-label="Apri su monitor esterno; chiudi la finestra per ripristinare il pannello"
    >
      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}
