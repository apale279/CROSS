import { useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { setTelegramBotPassword } from '../../services/telegramService';
import { btnPrimary, btnSecondary, FormField, inputClass } from '../ui/FormField';

export function TelegramBotPasswordEditor() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const passwordActive = (impostazioni?.telegramPasswordEpoch ?? 0) > 0;
  const epoch = impostazioni?.telegramPasswordEpoch ?? 0;

  const handleSave = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setFeedback({ type: 'error', message: 'Le password non coincidono' });
      return;
    }
    if (password.length < 4) {
      setFeedback({ type: 'error', message: 'Minimo 4 caratteri' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const res = await setTelegramBotPassword(password, {
        notifyUsers: true,
        manifestationId,
      });
      setPassword('');
      setConfirm('');
      setFeedback({
        type: 'ok',
        message: `Password impostata. ${res.invalidated ?? 0} dispositivi disconnessi: dovranno usare /cambiapassword, poi /start.`,
      });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message ?? 'Errore salvataggio' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Rimuovere la password del bot? Tutti potranno registrarsi senza password.')) {
      return;
    }
    setSaving(true);
    try {
      await setTelegramBotPassword('', { notifyUsers: false, manifestationId });
      setFeedback({ type: 'ok', message: 'Password rimossa' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message ?? 'Errore' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold text-slate-900">Bot Telegram — password</h3>
      <p className="mb-4 text-sm text-slate-600">
        L&apos;equipaggio dovrà inserire questa password su Telegram prima di scegliere il mezzo.
        Dopo ogni cambio password l&apos;equipaggio viene disconnesso:{' '}
        <strong>/cambiapassword</strong> → nuova password → <strong>/start</strong> → scelta mezzo.
        {passwordActive && (
          <span className="mt-2 block font-medium text-emerald-700">
            Password attiva (revisione {epoch})
          </span>
        )}
      </p>

      <form onSubmit={handleSave} className="grid gap-3">
        <FormField label="Nuova password bot">
          <input
            type="password"
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={passwordActive ? 'Sostituisci password…' : 'Imposta password…'}
          />
        </FormField>
        <FormField label="Conferma password">
          <input
            type="password"
            className={inputClass}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary} disabled={saving || !password}>
            {saving ? 'Salvataggio…' : passwordActive ? 'Cambia password' : 'Imposta password'}
          </button>
          {passwordActive && (
            <button type="button" className={btnSecondary} disabled={saving} onClick={() => void handleRemove()}>
              Rimuovi password
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <p
          role="status"
          className={`mt-3 rounded border px-3 py-2 text-sm font-medium ${
            feedback.type === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
