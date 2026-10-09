// Peringatan gratis lewat bot Telegram (opsional). Env: TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID.
// Tanpa env → tidak melakukan apa-apa. Dipanggil hanya saat ada peringatan (jarang), jadi hampir tanpa beban.
export async function sendTelegram(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: text.slice(0, 1000) }),
  }).catch(() => {});
}
