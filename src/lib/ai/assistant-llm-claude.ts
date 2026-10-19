import Anthropic, { toFile } from "@anthropic-ai/sdk";

import {
  DIAGNOSTIC_AGENT_TOOLS,
  runDiagnosticAgentTool,
  type DiagnosticAgentToolContext,
} from "@/lib/ai/diagnostic-agent-tools";
import { estimateCostUsd, logTokenUsage, WEB_SEARCH_COST_USD } from "@/lib/services/token-logger";

// Opus com raciocinio adaptativo: o agente de bancada precisa seguir nets,
// cruzar boardview/esquema e medicoes em varios passos antes de responder.
// Modelo e esforco podem ser trocados por env var sem alterar codigo.
// Custo: Opus 5.5 esforco high no dia a dia (dobro do preco do Sonnet 5.5
// medium usado ate 18/10) -- dono relatou que o Sonnet medium nao dava conta
// de casos mais dificeis e precisou usar o Claude Code por fora pra terminar
// o diagnostico do MS-1563. Em 19/10 o dia a dia foi para esforco medium: com
// high algumas respostas pensavam 2-4 min. "Pensar mais" e o parecer usam high.
const DEFAULT_CLAUDE_CHAT_MODEL = "claude-opus-5-5";
const DEFAULT_CLAUDE_DEEP_MODEL = "claude-opus-5-5";
const DEFAULT_CLAUDE_CHAT_EFFORT = "medium";
const DEFAULT_CLAUDE_DEEP_EFFORT = "high";
const CLAUDE_EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
// Voltas de consulta por mensagem. A conversa inteira fica em cache, entao cada
// volta extra custa pouco; o limite so evita que uma resposta se arraste.
const MAX_AGENT_ITERATIONS = 10;
// A conversa completa (com tudo o que a IA consultou) e reenviada a cada
// mensagem. Passando deste tamanho, a API resume o inicio automaticamente.
const COMPACTION_TRIGGER_TOKENS = 100_000;
const COMPACTION_INSTRUCTIONS = [
  "Resuma o inicio desta conversa de diagnostico de placa para o tecnico continuar sem perder nada.",
  "Mantenha obrigatoriamente: equipamento/placa; cada medicao com ponto, condicao da placa",
  "(fonte/bateria plugadas, ligada ou nao) e valor; o que o tecnico ja informou ou respondeu;",
  "nets, componentes, test points e paginas de esquema/boardview ja localizados e o que se",
  "concluiu deles; hipoteses com status; o que ja foi descartado; o proximo passo combinado.",
].join(" ");
const CHAT_BETAS = [
  "server-side-fallback-2026-07-01",
  "compact-2026-01-12",
  "thinking-binding-controls-2026-08-01",
];
// Modo de seguranca: o minimo possivel (historico so em texto, sem raciocinio
// salvo), para responder mesmo se a API recusar algo do pedido completo.
const SAFE_MODE_BETAS = ["server-side-fallback-2026-07-01"];
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

export function getClaudeChatEffort(deep = false): ClaudeEffort {
  const configured = (deep ? process.env.ANTHROPIC_CHAT_DEEP_EFFORT : process.env.ANTHROPIC_CHAT_EFFORT) as
    | ClaudeEffort
    | undefined;
  if (configured && CLAUDE_EFFORT_LEVELS.includes(configured)) {
    return configured;
  }
  return deep ? DEFAULT_CLAUDE_DEEP_EFFORT : DEFAULT_CLAUDE_CHAT_EFFORT;
}

export function isClaudeChatConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Traduz erros da API da Anthropic para uma mensagem que o tecnico entenda. */
export function toFriendlyClaudeError(error: unknown) {
  const raw = error instanceof Error ? error.message : String(error);
  const status = error instanceof Anthropic.APIError ? error.status : undefined;
  // Texto original da Anthropic no log da Vercel: a mensagem traduzida esconde o
  // detalhe (ex.: saldo zerado x limite de gasto mensal atingido).
  console.error(`Erro da Anthropic no chat (status ${status ?? "?"}): ${raw}`);

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

export type ClaudeChatResult = {
  replyText: string;
  sourcesUsed: string[];
  modelName: string;
  tokensInput: number;
  tokensOutput: number;
  /** Custo estimado desta resposta em US$ (todas as rodadas + buscas na web). */
  costUsd: number;
  /** Mensagens acrescentadas a conversa nesta resposta, para gravar no caso. */
  appendedMessages: Anthropic.Beta.BetaMessageParam[];
};

/**
 * Foto do chat como bloco de imagem. Vai para a Files API da Anthropic e entra
 * na conversa pelo file_id: a conversa guardada fica leve e a foto continua
 * visivel para a IA nas mensagens seguintes. Se o upload falhar, vai embutida.
 */
async function toImageBlock(
  client: Anthropic,
  image: ClaudeChatImage,
  index: number,
): Promise<Anthropic.Beta.BetaImageBlockParam> {
  const mediaType = image.mimeType as SupportedImageType;

  try {
    const extension = mediaType.split("/")[1] ?? "jpg";
    const uploaded = await client.files.upload({
      file: await toFile(Buffer.from(image.base64, "base64"), `foto-${index + 1}.${extension}`, {
        type: mediaType,
      }),
    });
    return { type: "image", source: { type: "file", file_id: uploaded.id } };
  } catch {
    return { type: "image", source: { type: "base64", media_type: mediaType, data: image.base64 } };
  }
}

/** Conteudo da mensagem do tecnico: fotos primeiro, depois o texto. */
export async function buildChatUserContent(
  text: string,
  images: ClaudeChatImage[],
  options: { inline?: boolean } = {},
): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
  const client = new Anthropic();
  const supported = images.filter((image) =>
    SUPPORTED_IMAGE_TYPES.includes(image.mimeType as SupportedImageType),
  );
  const skippedImages = images.length - supported.length;
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = await Promise.all(
    supported.map((image, index) =>
      options.inline
        ? ({
            type: "image",
            source: { type: "base64", media_type: image.mimeType as SupportedImageType, data: image.base64 },
          } satisfies Anthropic.Beta.BetaImageBlockParam)
        : toImageBlock(client, image, index),
    ),
  );

  const trimmed = text.trim() || "(mensagem sem texto, apenas anexo)";
  blocks.push({
    type: "text",
    text: skippedImages
      ? `${trimmed}\n(${skippedImages} foto(s) em formato não suportado pela IA foram ignoradas; peça em JPG ou PNG.)`
      : trimmed,
  });

  return blocks;
}

/**
 * Copia das mensagens com o ponto de cache na ultima mensagem do tecnico (ou
 * nos ultimos resultados de consulta): tudo antes dele e lido do cache na
 * proxima chamada. O marcador fica so na copia enviada, nunca na conversa
 * guardada, para nao acumular marcadores (a API aceita no maximo 4).
 */
function withCacheBreakpoint(messages: Anthropic.Beta.BetaMessageParam[]) {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  if (lastUserIndex === -1) {
    return messages;
  }

  const target = messages[lastUserIndex];
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    typeof target.content === "string" ? [{ type: "text", text: target.content }] : [...target.content];
  const last = content[content.length - 1];
  if (!last || !("type" in last) || !["text", "image", "tool_result", "document"].includes(last.type)) {
    return messages;
  }
  content[content.length - 1] = {
    ...last,
    cache_control: { type: "ephemeral", ttl: "1h" },
  } as Anthropic.Beta.BetaContentBlockParam;

  const copy = [...messages];
  copy[lastUserIndex] = { ...target, content };
  return copy;
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
  /** Instrucoes fixas: nunca mudam durante a conversa (cache e raciocinio salvo). */
  stableSystemPrompt: string;
  /** Conversa ja guardada do caso, reenviada sem nenhuma alteracao. */
  history: Anthropic.Beta.BetaMessageParam[];
  /** Mensagens novas desta vez: a do tecnico e, se mudou, o estado do caso. */
  newMessages: Anthropic.Beta.BetaMessageParam[];
  toolContext: DiagnosticAgentToolContext;
  /** "Pensar mais": usa o modelo mais forte (e mais caro) nesta mensagem. */
  deep?: boolean;
  /** Recebe o texto conforme a IA escreve e as consultas que ela faz. */
  onProgress?: (event: ClaudeChatProgressEvent) => void;
  /** Modo de seguranca: sem compactacao (usado se a API recusar o pedido completo). */
  safeMode?: boolean;
}): Promise<ClaudeChatResult> {
  if (!isClaudeChatConfigured()) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }

  const client = new Anthropic();
  const requestedModel = getClaudeChatModelName(Boolean(args.deep));
  const effort = getClaudeChatEffort(Boolean(args.deep));
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
  const messages: Anthropic.Beta.BetaMessageParam[] = [...args.history, ...args.newMessages];

  let tokensInput = 0;
  let tokensCacheRead = 0;
  let tokensCacheWrite = 0;
  let tokensCacheWrite1h = 0;
  let tokensOutput = 0;
  let servedModel = requestedModel;
  let costUsd = 0;
  let webSearchCount = 0;
  let replyText = "";
  let pausedText = "";
  const sources: string[] = [];

  for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration += 1) {
    const isLastIteration = iteration === MAX_AGENT_ITERATIONS - 1;
    const stream = client.beta.messages.stream({
      model: requestedModel,
      max_tokens: MAX_OUTPUT_TOKENS,
      betas: args.safeMode ? SAFE_MODE_BETAS : CHAT_BETAS,
      fallbacks: "default",
      // O raciocinio salvo so vale enquanto instrucoes e ferramentas nao mudam.
      // Ao mudar (nova ferramenta, prompt ajustado), "drop_block" descarta so o
      // raciocinio antigo e segue com a conversa, em vez de recusar o pedido.
      thinking: args.safeMode
        ? { type: "adaptive" }
        : { type: "adaptive", block_binding: { prefix_mismatch_behavior: "drop_block" } },
      output_config: { effort },
      ...(args.safeMode
        ? {}
        : {
            context_management: {
              edits: [
                {
                  type: "compact_20260112" as const,
                  trigger: { type: "input_tokens" as const, value: COMPACTION_TRIGGER_TOKENS },
                  instructions: COMPACTION_INSTRUCTIONS,
                },
              ],
            },
          }),
      // Instrucoes fixas e conversa em cache de 1 h: o tecnico manda mensagens
      // com intervalos maiores que os 5 min do cache padrao.
      system: [
        { type: "text", text: args.stableSystemPrompt, cache_control: { type: "ephemeral", ttl: "1h" } },
      ],
      tools,
      tool_choice: isLastIteration ? { type: "none" } : { type: "auto" },
      messages: withCacheBreakpoint(messages),
    });
    if (args.onProgress) {
      const onProgress = args.onProgress;
      stream.on("text", (delta) => onProgress({ type: "text", delta }));
    }
    const message = await stream.finalMessage().catch((error: unknown) => {
      throw toFriendlyClaudeError(error);
    });

    servedModel = message.model;
    // Custo rodada a rodada, com o modelo que de fato respondeu (o fallback pode
    // trocar de modelo no meio) e as buscas na web, cobradas a parte.
    const webSearches = message.usage.server_tool_use?.web_search_requests ?? 0;
    webSearchCount += webSearches;
    costUsd +=
      estimateCostUsd(message.model, message.usage.input_tokens, message.usage.output_tokens, {
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: message.usage.cache_creation_input_tokens ?? 0,
        cacheWrite1hTokens: message.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0,
      }) +
      webSearches * WEB_SEARCH_COST_USD;
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
      messages.push({ role: "assistant", content: [{ type: "text", text: replyText }] });
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
      // Resposta final: entra na conversa guardada como veio (raciocinio e
      // eventual bloco de compactacao incluidos).
      messages.push({ role: "assistant", content: toEchoContent(message.content) });
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
      extraCostUsd: webSearchCount * WEB_SEARCH_COST_USD,
    });
  }

  return {
    costUsd,
    replyText:
      replyText ||
      "Não foi possível gerar uma resposta agora. Tente reenviar a mensagem em instantes.",
    sourcesUsed: Array.from(new Set(sources)).slice(0, 8),
    modelName: servedModel,
    tokensInput: tokensInput + tokensCacheRead + tokensCacheWrite,
    tokensOutput,
    appendedMessages: messages.slice(args.history.length),
  };
}
