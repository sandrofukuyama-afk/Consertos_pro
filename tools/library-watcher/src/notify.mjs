// Aviso opcional pelo bot do Telegram do ConsertosPro.

export async function notifyTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }),
    });
    if (!response.ok) {
      console.warn("[telegram] aviso nao enviado:", response.status);
    }
  } catch (error) {
    console.warn("[telegram] aviso nao enviado:", error.message);
  }
}
