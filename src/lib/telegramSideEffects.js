/**
 * Notifiche Telegram da flussi missione/eventi: caricamento lazy, mai bloccanti.
 * Evita ReferenceError se il binding statico nel bundle non è disponibile.
 */

function scheduleTelegramImport(run, label = 'side effect') {
  void import('../services/telegramService.js')
    .then(run)
    .catch((err) => console.warn(`[telegram ${label}]`, err));
}

export function scheduleNotifyTelegramStatoFromCentrale(manifestationId, missionDocId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;
  scheduleTelegramImport((mod) => {
    mod.notifyTelegramStatoFromCentrale?.(manifestationId, id);
  }, 'notify stato');
}

export function scheduleNotifyTelegramMissioneEliminata(manifestationId, missionDocId) {
  const id = (missionDocId ?? '').trim();
  if (!id) return;
  scheduleTelegramImport((mod) => {
    mod.notifyTelegramMissioneEliminataFromCentrale?.(manifestationId, id);
  }, 'eliminata');
}
