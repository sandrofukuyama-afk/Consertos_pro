import { logTokenUsage } from "@/lib/services/token-logger";

// "claude-sonnet-5" e a familia de modelos Claude atual (melhor equilibrio
// entre velocidade e inteligencia). Pode ser sobrescrito via env var sem
// precisar alterar codigo caso a Anthropic lance um novo modelo recomendado.
const DEFAULT_CLAUDE_CHAT_MODEL = "claude-sonnet-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_TURN_CONTINUATIONS = 4;

export function getClaudeChatModelName() {
  return process.env.ANTHROPIC_CHAT_MODEL || DEFAULT_CLAUDE_CHAT_MODEL;
}

export function isClaudeChatConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ClaudeChatImage = {
  mimeType: string;
  base64: string;
};

export type ClaudeChatTurn = {
  role: "user" | "assistant";
  text: string;
  images?: ClaudeChatImage[];
};

export type ClaudeChatResult = {
  replyText: string;
  sourcesUsed: string[];
  modelName: string;
  tokensInput: number;
  tokensOutput: number;
};

type AnthropicBlock = Record<string, unknown>;

function buildContentBlocks(turn: ClaudeChatTurn): AnthropicBlock[] {
  const blocks: AnthropicBlock[] = [];

  for (const image of turn.images ?? []) {
    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mimeType,
        data: image.base64,
      },
    });
  }

  blocks.push({ type: "text", text: turn.text.trim() || "(mensagem sem texto, apenas anexo)" });

  return blocks;
}

function extractText(content: AnthropicBlock[]): string {
  return content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n\n")
    .trim();
}

function extractSources(content: AnthropicBlock[]): string[] {
  const sources: string[] = [];

  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content as AnthropicBlock[]) {
        const title = typeof result.title === "string" ? result.title : null;
        const url = typeof result.url === "string" ? result.url : null;

        if (url) {
          sources.push(title ? `${title} (${url})` : url);
        }
      }
    }
  }

  return Array.from(new Set(sources)).slice(0, 8);
}

/**
 * Chama a API da Anthropic (Claude) para gerar uma resposta de chat tecnica,
 * com busca na web habilitada para pesquisas complexas (datasheet, service
 * manual, forum de falhas conhecidas). Diferente do gerador de "parecer"
 * estruturado (OpenAI), aqui a resposta e texto livre de chat: direta,
 * dinamica, sem repetir o mesmo roteiro fixo a cada mensagem.
 */
export async function generateClaudeChatReply(args: {
  systemPrompt: string;
  turns: ClaudeChatTurn[];
}): Promise<ClaudeChatResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const modelName = getClaudeChatModelName();
  let currentMessages: Array<{ role: string; content: AnthropicBlock[] }> = args.turns.map(
    (turn) => ({
      role: turn.role,
      content: buildContentBlocks(turn),
    }),
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let combinedText = "";
  let sourcesUsed: string[] = [];

  for (let iteration = 0; iteration < MAX_TURN_CONTINUATIONS; iteration += 1) {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 1600,
        system: args.systemPrompt,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
        ],
        messages: currentMessages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(
        `Chamada à API da Anthropic falhou com status ${response.status}: ${errorBody.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      content?: AnthropicBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const content = payload.content ?? [];
    totalInputTokens += payload.usage?.input_tokens ?? 0;
    totalOutputTokens += payload.usage?.output_tokens ?? 0;

    const text = extractText(content);
    if (text) {
      combinedText = combinedText ? `${combinedText}\n\n${text}` : text;
    }
    sourcesUsed = Array.from(new Set([...sourcesUsed, ...extractSources(content)]));

    if (payload.stop_reason === "pause_turn") {
      currentMessages = [...currentMessages, { role: "assistant", content }];
      continue;
    }

    break;
  }

  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    logTokenUsage(modelName, "chat_diagnostico_claude", totalInputTokens, totalOutputTokens);
  }

  return {
    replyText:
      combinedText ||
      "Não foi possível gerar uma resposta agora. Tente reenviar a mensagem em instantes.",
    sourcesUsed,
    modelName,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
  };
}
