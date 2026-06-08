import { describe, expect, it } from 'vitest';
import { extractTelegramMessagesFromMission } from './telegramMissionMessages.js';
import { callbackQueryMessageRef } from './telegramMissionClose.js';

describe('telegramMissionClose', () => {
  it('estrae messaggi tracciati da più formati legacy', () => {
    const rows = extractTelegramMessagesFromMission({
      telegram_chat_id: 100,
      telegram_msg_id: 200,
      telegramMessages: [{ chatId: 101, messageId: 201 }],
    });
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { chatId: 100, messageId: 200 },
        { chatId: 101, messageId: 201 },
      ]),
    );
  });

  it('legge chat/message dal callback query', () => {
    expect(
      callbackQueryMessageRef({
        message: { chat: { id: 42 }, message_id: 7 },
      }),
    ).toEqual({ chatId: 42, messageId: 7 });
    expect(callbackQueryMessageRef({})).toBeNull();
  });
});
