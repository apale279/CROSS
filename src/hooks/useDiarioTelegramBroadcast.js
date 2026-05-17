import { useCallback, useState } from 'react';
import { useManifestazioneId } from '../context/ManifestazioneContext';
import { useImpostazioni } from './useImpostazioni';
import { broadcastNotaToTelegram } from '../services/telegramService';

export function useDiarioTelegramBroadcast() {
  const manifestationId = useManifestazioneId();
  const { impostazioni } = useImpostazioni();
  const [broadcasting, setBroadcasting] = useState(false);
  const telegramEnabled = impostazioni?.telegramBotEnabled === true;

  const broadcast = useCallback(
    async (nota) => {
      const titolo = (nota?.titolo ?? '').trim();
      if (!titolo) return;
      if (
        !window.confirm(
          `Inviare la nota «${titolo}» a tutti gli equipaggi loggati sul bot Telegram?`,
        )
      ) {
        return;
      }
      setBroadcasting(true);
      try {
        const res = await broadcastNotaToTelegram({
          titolo,
          testo: nota?.testo ?? '',
          manifestationId,
        });
        if (!res.ok) {
          alert(res.error ?? 'Invio non riuscito');
        } else {
          alert(`Nota inviata a ${res.sent} di ${res.total} equipaggi.`);
        }
      } finally {
        setBroadcasting(false);
      }
    },
    [manifestationId],
  );

  return {
    broadcasting,
    broadcast: telegramEnabled ? broadcast : undefined,
  };
}
