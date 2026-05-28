import { useState } from 'react';
import { useImpostazioni } from '../../hooks/useImpostazioni';
import { useImpostazioniEdit } from '../../context/ImpostazioniEditContext';
import { useManifestazioneId } from '../../context/ManifestazioneContext';
import { saveImpostazioniField } from '../../services/impostazioniService';

const BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME ?? '').trim().replace(/^@/, '');

export function TelegramBotToggle() {
  const manifestationId = useManifestazioneId();
  const { impostazioni, loading } = useImpostazioni();
  const { canEdit, profileLoading } = useImpostazioniEdit();
  const [saving, setSaving] = useState(false);

  const enabled = impostazioni?.telegramBotEnabled === true;
  const toggleDisabled = loading || saving || profileLoading || !canEdit;

  const toggle = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await saveImpostazioniField(manifestationId, 'telegramBotEnabled', !enabled);
    } catch (err) {
      console.error(err);
      alert('Errore salvataggio impostazione Telegram: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-slate-300 bg-slate-50 px-2 py-1">
      <span className="text-xs font-bold uppercase text-slate-700">Bot Telegram</span>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={toggleDisabled}
        title={
          !canEdit
            ? 'Sola lettura: non puoi modificare le impostazioni'
            : enabled
              ? 'Disattiva invio missioni su Telegram'
              : 'Attiva invio missioni su Telegram'
        }
        className={`rounded px-2 py-1 text-xs font-bold uppercase ${
          enabled
            ? 'border border-emerald-400 bg-emerald-100 text-emerald-900'
            : 'border border-slate-300 bg-white text-slate-600'
        } disabled:opacity-50`}
      >
        {saving ? '…' : enabled ? 'Attivo' : 'Spento'}
      </button>
      {BOT_USERNAME && (
        <a
          href={`https://t.me/${BOT_USERNAME}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-sky-700 underline hover:text-sky-900"
          onClick={(e) => e.stopPropagation()}
        >
          @{BOT_USERNAME}
        </a>
      )}
    </div>
  );
}
