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
const DEFAULT_CLAUDE_CHAT_MODEL = "claude-opus-5";
const DEFAULT_CLAUDE_CHAT_EFFORT = "high";
const CLAUDE_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
const MAX_AGENT_ITERATIONS = 16;
const MAX_OUTPUT_TOKENS = 32000;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

type ClaudeEffort = (typeof CLAUDE_EFFORT_LEVELS)[number];
type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

export function getClaudeChatModelName() {
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
}): Promise<ClaudeChatResult> {
  if (!isClaudeChatConfigured()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const client = new Anthropic();
  const requestedModel = getClaudeChatModelName();
  const effort = getClaudeChatEffort();
  const tools: Anthropic.Beta.BetaToolUnion[] = [
    ...DIAGNOSTIC_AGENT_TOOLS,
    { type: "web_search_20260209", name: "web_search", max_uses: 5 },
    { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
  ];
  const messages: Anthropic.Beta.BetaMessageParam[] = args.turns.map((turn) => ({
    role: turn.role,
    content: buildContentBlocks(turn),
  }));

  let tokensInput = 0;
  let tokensOutput = 0;
  let servedModel = requestedModel;
  let replyText = "";
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
        { type: "text", text: args.stableSystemPrompt, cache_control: { type: "ephemeral" } },
        { type: "text", text: args.caseSystemPrompt },
      ],
      tools,
      tool_choice: isLastIteration ? { type: "none" } : { type: "auto" },
      messages,
    });
    const message = await stream.finalMessage();

    servedModel = message.model;
    tokensInput +=
      message.usage.input_tokens +
      (message.usage.cache_creation_input_tokens ?? 0) +
      (message.usage.cache_read_input_tokens ?? 0);
    tokensOutput += message.usage.output_tokens;
    sources.push(...extractSources(message.content));

    const text = extractText(message.content);
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
      messages.push({ role: "assistant", content: toEchoContent(message.content) });
      continue;
    }

    const toolUses = message.content.filter(
      (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use",
    );

    if (message.stop_reason !== "tool_use" || !toolUses.length) {
      break;
    }

    messages.push({ role: "assistant", content: toEchoContent(message.content) });
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

  if (tokensInput > 0 || tokensOutput > 0) {
    logTokenUsage(servedModel, "chat_diagnostico_claude", tokensInput, tokensOutput);
  }

  return {
    replyText:
      replyText ||
      "Não foi possível gerar uma resposta agora. Tente reenviar a mensagem em instantes.",
    sourcesUsed: Array.from(new Set(sources)).slice(0, 8),
    modelName: servedModel,
    tokensInput,
    tokensOutput,
  };
}
