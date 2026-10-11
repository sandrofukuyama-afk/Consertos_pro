// Registra o webhook do bot do Telegram apontando para o app publicado.
//
// Uso: node scripts/telegram-set-webhook.mjs [url-do-app]
// Le TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET do .env.local (os mesmos valores
// configurados na Vercel).

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^["']|["']$/g, "")]),
);

const token = env.TELEGRAM_BOT_TOKEN;
const secret = env.TELEGRAM_WEBHOOK_SECRET;
const appUrl = (process.argv[2] ?? "https://consertos-pro.vercel.app").replace(/\/$/, "");

if (!token || !secret) {
  console.error("Faltam TELEGRAM_BOT_TOKEN ou TELEGRAM_WEBHOOK_SECRET no .env.local.");
  process.exit(1);
}

async function call(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!payload.ok) {
    throw new Error(`${method}: ${payload.description}`);
  }
  return payload.result;
}

await call("setWebhook", {
  url: `${appUrl}/api/telegram/webhook`,
  secret_token: secret,
  allowed_updates: ["message", "callback_query"],
  drop_pending_updates: true,
});
await call("setMyCommands", {
  commands: [{ command: "ajuda", description: "Como buscar esquemas, boardviews e BIOS" }],
});

const info = await call("getWebhookInfo", {});
console.log("Webhook registrado:", info.url);
