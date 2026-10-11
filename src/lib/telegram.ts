// Cliente minimo da Bot API do Telegram (https://core.telegram.org/bots/api).

export type TelegramInlineButton = { text: string; callback_data: string };

export type TelegramUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number } };
    data?: string;
  };
};

// Bots so podem enviar arquivos de ate 50 MB.
export const TELEGRAM_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

function botUrl(method: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN nao configurado.");
  }
  return `https://api.telegram.org/bot${token}/${method}`;
}

async function call(method: string, body: Record<string, unknown> | FormData) {
  const response = await fetch(botUrl(method), {
    method: "POST",
    ...(body instanceof FormData
      ? { body }
      : { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;

  if (!response.ok || !payload?.ok) {
    throw new Error(`Telegram ${method}: ${payload?.description ?? response.status}`);
  }
}

export function sendTelegramMessage(
  chatId: number,
  text: string,
  buttons?: TelegramInlineButton[][],
) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  });
}

export function answerTelegramCallback(callbackQueryId: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: callbackQueryId, ...(text ? { text } : {}) });
}

export function sendTelegramChatAction(chatId: number, action: "typing" | "upload_document") {
  return call("sendChatAction", { chat_id: chatId, action });
}

export function sendTelegramDocument(chatId: number, file: Blob, fileName: string, caption: string) {
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1024));
  form.append("document", file, fileName);
  return call("sendDocument", form);
}
