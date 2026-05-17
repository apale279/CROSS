import { useState } from 'react';
import { forceTelegramBotLogout } from '../../services/globalLogoutService';
import { btnSecondary } from '../ui/FormField';

export function TelegramForceLogoutPanel() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const run = async () => {
    if (
      !window.confirm(
        'Disconnettere tutti gli equipaggi dal bot Telegram? Dovranno rifare /start e scegliere il mezzo. I messaggi sul telefono non vengono cancellati.',
      )
    ) {
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await forceTelegramBotLogout();
      setFeedback({
        type: 'ok',
        message: `${res.invalidated ?? 0} sessioni bot terminate.`,
      });
    } catch (e) {
      setFeedback({ type: 'error', message: e?.message ?? String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
      <h3 className="text-sm font-bold uppercase text-amber-950">Fine evento — forza logout bot</h3>
      <p className="mt-2 text-sm text-amber-950/90">
        Disconnette tutti gli utenti Telegram collegati a un mezzo (password invariata). Usare a fine
        turno quando l&apos;equipaggio non deve più ricevere missioni. Non cancella i messaggi e non
        disconnette gli operatori dall&apos;app web.
      </p>
      {feedback && (
        <p
          className={`mt-2 rounded border px-2 py-1 text-xs font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-300 bg-white text-emerald-800'
              : 'border-red-300 bg-white text-red-800'
          }`}
        >
          {feedback.message}
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className={`${btnSecondary} mt-3 border-amber-400 font-bold uppercase`}
      >
        {busy ? 'In corso…' : 'Forza logout'}
      </button>
    </section>
  );
}
