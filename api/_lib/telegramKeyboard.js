/** Tastiera persistente equipaggio Telegram (SOS + comandi rapidi). */
export function buildEquipaggioReplyKeyboard() {
  return {
    keyboard: [
      [{ text: '🚨 SOS / EMERGENZA' }],
      [{ text: '/stato' }, { text: '/gps' }],
      [{ text: '/start' }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}
