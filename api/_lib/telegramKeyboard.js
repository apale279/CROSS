export const TG_MENU_STATO = 'tgmenu:stato';
export const TG_MENU_GPS = 'tgmenu:gps';
export const TG_MENU_START = 'tgmenu:start';
export const TG_MENU_SOS = 'tgmenu:sos';

/** Menu equipaggio Telegram in inline keyboard (SOS + comandi rapidi). */
export function buildEquipaggioReplyKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚨 SOS / EMERGENZA', callback_data: TG_MENU_SOS }],
      [
        { text: '📋 Stato missione', callback_data: TG_MENU_STATO },
        { text: '📍 GPS mezzo', callback_data: TG_MENU_GPS },
      ],
      [{ text: '🔄 Cambia mezzo', callback_data: TG_MENU_START }],
    ],
  };
}
