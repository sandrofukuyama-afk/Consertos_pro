import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { searchDonorComponents } from "@/lib/services/donor-boards";
import { searchTechnicalLibrary } from "@/lib/services/technical-library-search";
import {
  TELEGRAM_MAX_UPLOAD_BYTES,
  answerTelegramCallback,
  sendTelegramChatAction,
  sendTelegramDocument,
  sendTelegramMessage,
  type TelegramInlineButton,
  type TelegramUpdate,
} from "@/lib/telegram";

// Baixar do Storage e reenviar ao Telegram pode levar alguns segundos.
export const maxDuration = 60;

const MAX_RESULTS = 10;
const TYPE_ICON: Record<string, string> = {
  schematic_pdf: "📘",
  boardview: "🧩",
  bios: "💾",
  firmware: "⚙️",
  datasheet: "📄",
};

const HELP_TEXT = [
  "Biblioteca técnica do ConsertosPro.",
  "",
  "Mande o modelo ou o código da placa, por exemplo:",
  "• dell 5567",
  "• la-d802p",
  "• msi 3080",
  "• 820-3437",
  "• toshiba l855 bios",
  "",
  "Toque no arquivo para recebê-lo aqui.",
  "",
  "Para achar um componente nas placas doadoras:",
  "• peça AON7506",
  "• peça 10U 0603",
].join("\n");

const DONOR_PREFIX = /^\/?pe[cç]a\s+/i;

async function handleDonorSearch(chatId: number, query: string) {
  await sendTelegramChatAction(chatId, "typing");
  const results = await searchDonorComponents(createSupabaseAdminClient(), query);

  if (!results.length) {
    await sendTelegramMessage(chatId, `Nenhuma placa doadora com "${query}".\nTente só o código principal (ex.: AON7506).`);
    return;
  }

  const blocks = results.slice(0, 8).map((result) => {
    const positions = result.hits
      .filter((hit) => hit.refdes)
      .slice(0, 6)
      .map((hit) => `${hit.refdes}${hit.page ? ` (pág. ${hit.page})` : ""}`);
    const extra = result.hits.some((hit) => !hit.refdes)
      ? result.hits.some((hit) => hit.source === "foto")
        ? "lido na foto"
        : "citado no esquema"
      : null;
    return `📦 ${result.code} • ${result.title}\n    ${[positions.join(", "), extra].filter(Boolean).join(" • ")}`;
  });

  await sendTelegramMessage(
    chatId,
    `🔎 "${query}" em ${results.length} placa(s) doadora(s):\n\n${blocks.join("\n")}\n\nNo app, em Doadoras, dá para ver no boardview.`,
  );
}

function allowedUserIds() {
  return new Set(
    (process.env.TELEGRAM_ALLOWED_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

async function handleSearch(chatId: number, text: string) {
  const query = text.trim();

  if (!query || query === "/start" || query === "/ajuda" || query === "/help") {
    await sendTelegramMessage(chatId, HELP_TEXT);
    return;
  }

  if (DONOR_PREFIX.test(query)) {
    await handleDonorSearch(chatId, query.replace(DONOR_PREFIX, "").trim());
    return;
  }

  await sendTelegramChatAction(chatId, "typing");
  const { total, results } = await searchTechnicalLibrary(createSupabaseAdminClient(), query);

  if (!results.length) {
    await sendTelegramMessage(
      chatId,
      `Nada encontrado para "${query}".\nTente menos palavras ou só o código da placa (ex.: la-d801p, da0hk9mb6d0, 820-3437).`,
    );
    return;
  }

  const shown = results.slice(0, MAX_RESULTS);
  const lines = shown.map(
    (item, index) =>
      `${index + 1}. ${TYPE_ICON[item.assetType] ?? "📎"} ${item.displayName}\n    ${item.originalFileName} • ${formatSize(item.fileSizeBytes)}`,
  );
  const buttons: TelegramInlineButton[][] = shown.map((item, index) => [
    {
      text: truncate(`${index + 1}. ${TYPE_ICON[item.assetType] ?? "📎"} ${item.originalFileName}`, 60),
      callback_data: `a:${item.id}`,
    },
  ]);
  const footer =
    total > shown.length
      ? `\nMostrando ${shown.length} de ${total}. Refine a busca (ex.: "${query} bios" ou o código da placa).`
      : "";

  await sendTelegramMessage(
    chatId,
    `${total} arquivo(s) para "${query}":\n\n${lines.join("\n")}${footer}\n\nToque para receber:`,
    buttons,
  );
}

async function handleDownload(chatId: number, callbackId: string, assetId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: asset, error } = await supabase
    .from("technical_assets")
    .select("id, original_filename, file_size_bytes, storage_bucket, storage_path, metadata")
    .eq("id", assetId)
    .maybeSingle();

  if (error || !asset) {
    await answerTelegramCallback(callbackId, "Arquivo não encontrado.");
    return;
  }

  if (asset.file_size_bytes > TELEGRAM_MAX_UPLOAD_BYTES) {
    await answerTelegramCallback(callbackId, "Arquivo maior que 50 MB: baixe pelo app.");
    return;
  }

  await answerTelegramCallback(callbackId, "Enviando…");
  await sendTelegramChatAction(chatId, "upload_document");

  const download = await supabase.storage.from(asset.storage_bucket).download(asset.storage_path);
  if (download.error || !download.data) {
    await sendTelegramMessage(chatId, `Falha ao baixar ${asset.original_filename} do armazenamento.`);
    return;
  }

  const metadata = (asset.metadata ?? {}) as Record<string, unknown>;
  const description =
    typeof metadata.description === "string" ? metadata.description.split(" • Origem:")[0] : "";
  const caption = [metadata.display_name, description].filter(Boolean).join("\n");

  await sendTelegramDocument(chatId, download.data, asset.original_filename, caption);
}

export async function POST(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  // So o Telegram conhece o segredo (enviado no registro do webhook).
  if (!expectedSecret || request.headers.get("x-telegram-bot-api-secret-token") !== expectedSecret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const callback = update?.callback_query;
  const userId = message?.from?.id ?? callback?.from.id;
  const chatId = message?.chat.id ?? callback?.message?.chat.id;

  if (!userId || !chatId) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (!allowedUserIds().has(String(userId))) {
      // Mostra o proprio ID para o dono conseguir se liberar na configuracao.
      if (message) {
        await sendTelegramMessage(chatId, `Acesso não autorizado.\nSeu ID do Telegram: ${userId}`);
      } else if (callback) {
        await answerTelegramCallback(callback.id, "Acesso não autorizado.");
      }
      return NextResponse.json({ ok: true });
    }

    if (callback?.data?.startsWith("a:")) {
      await handleDownload(chatId, callback.id, callback.data.slice(2));
    } else if (message?.text) {
      await handleSearch(chatId, message.text);
    }
  } catch (error) {
    console.error("[telegram] falha ao responder", error);
    await sendTelegramMessage(chatId, "Ops, algo deu errado. Tente de novo em instantes.").catch(() => undefined);
  }

  // Sempre 200: senao o Telegram reenvia a mesma mensagem varias vezes.
  return NextResponse.json({ ok: true });
}
