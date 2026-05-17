import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { executeGlobalLogoutAndTelegramWipe } from '../../services/globalLogoutService';
import { btnPrimary, btnSecondary } from '../ui/FormField';

function ConfirmModal({ title, children, tone = 'default', onCancel, onConfirm, confirmLabel }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-900/55 p-4"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-xl border shadow-xl ${
          tone === 'danger'
            ? 'border-red-700 bg-red-950 text-red-50'
            : 'border-slate-200 bg-white text-slate-900'
        }`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex items-start justify-between gap-2 border-b px-5 py-4 ${
            tone === 'danger' ? 'border-red-800' : 'border-slate-200'
          }`}
        >
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className={`rounded p-1 ${
              tone === 'danger' ? 'hover:bg-red-900' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm leading-relaxed">{children}</div>
        <div
          className={`flex flex-wrap justify-end gap-2 border-t px-5 py-4 ${
            tone === 'danger' ? 'border-red-800' : 'border-slate-200'
          }`}
        >
          <button type="button" className={btnSecondary} onClick={onCancel}>
            Annulla
          </button>
          <button
            type="button"
            className={
              tone === 'danger'
                ? 'rounded-lg border border-red-300 bg-red-600 px-4 py-2 text-sm font-bold uppercase text-white hover:bg-red-500'
                : btnPrimary
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GlobalLogoutPuliziaPanel() {
  const manifestationId = useManifestazioneId();
  const [step, setStep] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    setStep(null);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await executeGlobalLogoutAndTelegramWipe(manifestationId);
      setResult(res);
    } catch (e) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border-2 border-red-300 bg-red-50/90 p-4">
      <h3 className="flex items-center gap-2 text-sm font-bold uppercase text-red-950">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Console amministrazione
      </h3>
      <p className="mt-2 text-sm text-red-950/90">
        Disconnette istantaneamente tutti gli operatori (sessioni mezzi e account), cancella i
        messaggi missione su Telegram e azzera le associazioni equipaggio del bot.
      </p>

      {error && (
        <p className="mt-2 rounded border border-red-400 bg-white px-2 py-1 text-xs text-red-800">
          {error}
        </p>
      )}
      {result && (
        <p className="mt-2 rounded border border-emerald-300 bg-white px-2 py-1 text-xs text-emerald-900">
          Completato: {result.mezziCleared} mezzi, {result.usersCleared} profili utente. Telegram:{' '}
          {result.telegram?.messagesDeleted ?? 0} messaggi rimossi,{' '}
          {result.telegram?.telegramUsersDeleted ?? 0} utenti bot resettati.
          {busy ? '' : ' Verrai disconnesso a breve se ancora connesso.'}
        </p>
      )}

      <button
        type="button"
        disabled={busy || !manifestationId}
        onClick={() => {
          setError(null);
          setResult(null);
          setStep(1);
        }}
        className="mt-3 rounded-lg border-2 border-red-800 bg-red-700 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Operazione in corso…' : 'Logout globale e pulizia'}
      </button>

      {step === 1 && (
        <ConfirmModal
          title="Conferma logout globale"
          onCancel={() => setStep(null)}
          onConfirm={() => setStep(2)}
          confirmLabel="Conferma"
        >
          <p>
            Sei sicuro di voler disconnettere tutti i dispositivi e ripulire i dati?
          </p>
          <p className="text-slate-600">
            Verranno azzerate le sessioni attive su mezzi e profili utente, quindi verrà avviata la
            cancellazione dei messaggi Telegram collegati alle missioni.
          </p>
        </ConfirmModal>
      )}

      {step === 2 && (
        <ConfirmModal
          title="Azione irreversibile"
          tone="danger"
          onCancel={() => setStep(null)}
          onConfirm={() => void run()}
          confirmLabel="Procedi"
        >
          <p className="font-semibold">
            Azione irreversibile. Tutti gli operatori sul campo verranno buttati fuori
            dall&apos;applicazione. Vuoi procedere davvero?
          </p>
          <p className="text-red-100/90">
            I messaggi missione su Telegram verranno eliminati dai dispositivi e le sessioni bot
            verranno resettate.
          </p>
        </ConfirmModal>
      )}
    </section>
  );
}
