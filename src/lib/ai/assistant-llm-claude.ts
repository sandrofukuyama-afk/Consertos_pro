import Anthropic from "@anthropic-ai/sdk";

import {
  DIAGNOSTIC_AGENT_TOOLS,
  runDiagnosticAgentTool,
  type DiagnosticAgentToolContext,
} from "@/lib/ai/diagnostic-agent-tools";
import { logTokenUsage } from "@/lib/services/token-logger";

// Opus com raciocinio adaptativo: o agente de bancada precisa seguir nets,
// cruzar boardview/esquema e medicoes em varios passos antes de responder.
// Modelo e esforco podem ser trocados por env var sem alterar codigo.
// Custo: Sonnet 5.5 no dia a dia (metade do preco do Opus); o botao
// "Pensar mais" do chat e o parecer usam o Opus 5.5.
const DEFAULT_CLAUDE_CHAT_MODEL = "claude-sonnet-5-5";
const DEFAULT_CLAUDE_DEEP_MODEL = "claude-opus-5-5";
const DEFAULT_CLAUDE_CHAT_EFFORT = "medium";
const CLAUDE_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
// Cada volta reenvia a conversa e tudo o que ja foi consultado: limitar as
// voltas e o tamanho das paginas da web e o que mais segura o custo.
const MAX_AGENT_ITERATIONS = 6;
const WEB_FETCH_MAX_CONTENT_TOKENS = 4000;
const MAX_OUTPUT_TOKENS = 32000;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

type ClaudeEffort = (typeof CLAUDE_EFFORT_LEVELS)[number];
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function getClaudeChatModelName(deep = false) {
  if (deep) {
    return process.env.ANTHROPIC_CHAT_DEEP_MODEL || DEFAULT_CLAUDE_DEEP_MODEL;
  }
  return process.env.ANTHROPIC_CHAT_MODEL || DEFAULT_CLAUDE_CHAT_MODEL;
}

export function getClaudeChatEffort(): ClaudeEffort {
  const configured = process.env.ANTHROPIC_CHAT_EFFORT as ClaudeEffort | undefined;
  return configured && CLAUDE_EFFORT_LEVELS.includes(configured)
    ? configured
    : DEFAULT_CLAUDE_CHAT_EFFORT;
}

export function isClaudeChatConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Traduz erros da API da Anthropic para uma mensagem que o tecnico entenda. */
export function toFriendlyClaudeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const status = error instanceof Anthropic.APIError ? error.status : undefined;

  if (/credit balance|billing|purchase credits/i.test(raw)) {
    return new Error(
      "Os créditos da IA (Anthropic) acabaram. Recarregue em console.anthropic.com → Billing e envie de novo. Sua mensagem ficou salva no caso.",
    );
  }
  if (status === 401 || /invalid x-api-key|authentication/i.test(raw)) {
    return new Error("A chave da IA (ANTHROPIC_API_KEY) foi recusada. Confira a variável na Vercel.");
  }
  if (status === 429 || status === 529 || /overloaded|rate limit/i.test(raw)) {
    return new Error("A IA está sobrecarregada agora. Espere um minuto e envie de novo.");
  }
  return error instanceof Error ? error : new Error(raw);
}

/** Avisos enviados enquanto a IA trabalha, para a tela mostrar o progresso. */
export type ClaudeChatProgressEvent =
  | { type: "text"; delta: string }
  | { type: "tools"; names: string[] };

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

function buildContentBlocks(turn: ClaudeChatTurn): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  let skippedImages = 0;

  for (const image of turn.images ?? []) {
    if (!SUPPORTED_IMAGE_TYPES.includes(image.mimeType as SupportedImageType)) {
      skippedImages += 1;
      continue;
    }

    blocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mimeType as SupportedImageType,
        data: image.base64,
      },
    });
  }

  const text = turn.text.trim() || "(mensagem sem texto, apenas anexo)";
  blocks.push({
    type: "text",
    text: skippedImages
      ? `${text}\n(${skippedImages} foto(s) em formato não suportado pela IA foram ignoradas; peça em JPG ou PNG.)`
      : text,
  });

  return blocks;
}

function extractText(content: Anthropic.Beta.BetaContentBlock[]) {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

function extractSources(content: Anthropic.Beta.BetaContentBlock[]) {
  const sources: string[] = [];

  for (const block of content) {
    if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
      for (const result of block.content) {
        sources.push(result.title ? `${result.title} (${result.url})` : result.url);
      }
    }
  }

  return sources;
}

/**
 * Prepara o conteudo de uma resposta para ser reenviado no historico. Depois
 * de um fallback no meio da resposta, blocos internos gerados antes da troca de
 * modelo (thinking, tool_use, server_tool_use sem resultado) nao podem voltar.
 */
function toEchoContent(content: Anthropic.Beta.BetaContentBlock[]) {
  const lastFallbackIndex = content.map((block) => block.type).lastIndexOf("fallback");

  if (lastFallbackIndex === -1) {
    return content as Anthropic.Beta.BetaContentBlockParam[];
  }

  const serverToolResultIds = new Set(
    content
      .filter((block) => "tool_use_id" in block)
      .map((block) => (block as { tool_use_id: string }).tool_use_id),
  );

  return content.filter((block, index) => {
    if (index >= lastFallbackIndex) {
      return true;
    }

    if (block.type === "thinking" || block.type === "redacted_thinking" || block.type === "tool_use") {
      return false;
    }

    if (block.type === "server_tool_use") {
      return serverToolResultIds.has(block.id);
    }

    return true;
  }) as Anthropic.Beta.BetaContentBlockParam[];
}

/**
 * Agente de diagnostico de bancada: conversa com o tecnico e, antes de
 * responder, consulta boardview/esquema do caso, le e grava medicoes e
 * hipoteses, e pesquisa na web quando precisa de dado externo.
 */
export async function runClaudeDiagnosticAgent(args: {
  stableSystemPrompt: string;
  caseSystemPrompt: string;
  turns: ClaudeChatTurn[];
  toolContext: DiagnosticAgentToolContext;
  /** "Pensar mais": usa o modelo mais forte (e mais caro) nesta mensagem. */
  deep?: boolean;
  /** Recebe o texto conforme a IA escreve e as consultas que ela faz. */
  onProgress?: (event: ClaudeChatProgressEvent) => void;
}): Promise<ClaudeChatResult> {
  if (!isClaudeChatConfigured()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const client = new Anthropic();
  const requestedModel = getClaudeChatModelName(Boolean(args.deep));
  const effort = getClaudeChatEffort();
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    ...DIAGNOSTIC_AGENT_TOOLS,
    { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    {
      type: "web_fetch_20260209",
      name: "web_fetch",
      max_uses: 2,
      max_content_tokens: WEB_FETCH_MAX_CONTENT_TOKENS,
    },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = args.turns.map((turn) => ({
    role: turn.role,
    content: buildContentBlocks(turn),
  }));

  let tokensInput = 0;
  let tokensCacheRead = 0;
  let tokensCacheWrite = 0;
  let tokensCacheWrite1h = 0;
  let tokensOutput = 0;
  let servedModel = requestedModel;
  let replyText = "";
  let pausedText = "";
  const sources: string[] = [];

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const isLastIteration = iteration === MAX_AGENT_ITERATIONS - 1;
    const stream = client.beta.messages.stream({
      model: requestedModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort },
      cache_control: { type: "ephemeral" },
      system: [
        // Instrucoes fixas em cache de 1 h: o tecnico manda mensagens com
        // intervalos maiores que os 5 min do cache padrao.
        { type: "text", text: args.stableSystemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } },
        { type: "text", text: args.caseSystemPrompt },
      ],
      tools,
      tool_choice: isLastIteration ? { type: "none" } : { type: "auto" },
      messages,
    });
    if (args.onProgress) {
      const onProgress = args.onProgress;
      stream.on("text", (delta) => onProgress({ type: "text", delta }));
    }
    const message = await stream.finalMessage().catch((error: unknown) => {
      throw toFriendlyClaudeError(error);
    });

    servedModel = message.model;
    tokensInput += message.usage.input_tokens;
    tokensCacheWrite += message.usage.cache_creation_input_tokens ?? 0;
    tokensCacheWrite1h += message.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
    tokensCacheRead += message.usage.cache_read_input_tokens ?? 0;
    tokensOutput += message.usage.output_tokens;
    sources.push(...extractSources(message.content));

    // Depois de um pause_turn (busca na web longa) a resposta continua na volta
    // seguinte: junta os pedacos, como o tecnico viu na tela durante o streaming.
    const text = pausedText + extractText(message.content);
    if (text) {
      replyText = text;
    }

    if (message.stop_reason === "refusal") {
      replyText =
        replyText ||
        "A IA não conseguiu responder a esta mensagem. Reformule o pedido com foco no reparo da placa.";
      break;
    }

    if (message.stop_reason === "pause_turn") {
      pausedText = text;
      messages.push({ role: "assistant", content: toEchoContent(message.content) });
      continue;
    }

    // O texto antes de uma consulta e so um aviso; a resposta comeca do zero.
    pausedText = "";

    const toolUses = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
    );

    if (message.stop_reason !== "tool_use" || !toolUses.length) {
      break;
    }

    messages.push({ role: "assistant", content: toEchoContent(message.content) });
    args.onProgress?.({ type: "tools", names: toolUses.map((toolUse) => toolUse.name) });
    const toolResults = await Promise.all(
      toolUses.map((toolUse) => runDiagnosticAgentTool(args.toolContext, toolUse)),
    );
    const nextUserContent: Anthropic.Beta.BetaContentBlockParam[] = [...toolResults];

    if (iteration === MAX_AGENT_ITERATIONS - 2) {
      nextUserContent.push({
        type: "text",
        text: "Limite de consultas desta resposta atingido. Responda agora ao técnico com o que já foi apurado e diga o que falta verificar.",
      });
    }

    messages.push({ role: "user", content: nextUserContent });
  }

  if (tokensInput > 0 || tokensCacheRead > 0 || tokensOutput > 0) {
    logTokenUsage(servedModel, "chat_diagnostico_claude", tokensInput, tokensOutput, {
      cacheReadTokens: tokensCacheRead,
      cacheWriteTokens: tokensCacheWrite,
      cacheWrite1hTokens: tokensCacheWrite1h,
    });
  }

  return {
    replyText:
      replyText ||
      "Não foi possível gerar uma resposta agora. Tente reenviar a mensagem em instantes.",
    sourcesUsed: Array.from(new Set(sources)).slice(0, 8),
    modelName: servedModel,
    tokensInput: tokensInput + tokensCacheRead + tokensCacheWrite,
    tokensOutput,
  };
}
