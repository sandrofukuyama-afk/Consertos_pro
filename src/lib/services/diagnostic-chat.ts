import { createHash } from "node:crypto";

import Anthropic from "@anthropic-ai/sdk";

import { createClient } from "@/lib/supabase/server";
import {
  buildChatUserContent,
  isClaudeChatConfigured,
  runClaudeDiagnosticAgent,
  type ClaudeChatProgressEvent,
} from "@/lib/ai/assistant-llm-claude";
import { getSpecialistAgent } from "@/lib/domain/specialist-agents";
import {
  getDiagnosticAssistantContext,
  getSimilarCasesAndDocuments,
  type DiagnosticAssistantContext,
} from "@/lib/services/assistant";
import {
  type AssistantTechnicalContextSupabaseClient,
  type DiagnosticTechnicalWorkbench,
  openDiagnosticTechnicalWorkbench,
} from "@/lib/services/assistant-technical-context";

export type NewChatAttachment = {
  id: string;
  mimeType: string;
  base64: string;
};

type ChatMessage = Anthropic.Beta.BetaMessageParam;

// A IA recebe a conversa inteira do caso, como no Claude Code: o que o tecnico
// disse, o que ela consultou (boardview, esquema, web) e o que concluiu. Antes
// so iam as ultimas 8 mensagens em texto, e ela repetia perguntas e consultas.
// O custo fica controlado pelo cache (conversa relida a ~10% do preco) e pela
// compactacao automatica quando a conversa fica muito longa.

const PERSONA_PROMPT = [
  "Voce e o especialista de bancada responsavel por resolver este caso: um tecnico",
  "eletronico senior em reparo de placas de notebook e desktop (placas-mae, fontes,",
  "placas de video), com dominio de sequencia de energizacao, rails de alimentacao,",
  "PMIC/chargers, EC/SMC, firmware de BIOS/EC, curto em rails, sinais de reset e",
  "power good. Voce conversa em tempo real com o tecnico que esta com a placa na mao:",
  "ele mede, voce conduz o raciocinio e decide o proximo passo.",
  "",
  "Como trabalhar:",
  "- Conduza o diagnostico, nao apenas aconselhe. A cada mensagem, cruze o que o",
  "  tecnico relatou com o historico e os arquivos tecnicos, atualize o raciocinio e",
  "  diga exatamente qual e a proxima medicao ou acao, onde (componente, pino, net ou",
  "  test point), com a placa em qual condicao, o valor esperado e o que cada",
  "  resultado possivel significa.",
  "- Use as ferramentas antes de afirmar algo sobre o circuito. Com boardview/esquema",
  "  ativos, confirme nomes reais de nets e referencias, siga a net para achar quem",
  "  gera o rail, o que esta pendurado nele e onde medir, e leia a pagina do esquema",
  "  relevante (sequencia de power, enable, power good). Cite as referencias reais que",
  "  encontrou. Compare medicoes com os valores_de_referencia da placa quando",
  "  existirem. Se nenhum arquivo estiver ativo, procure na biblioteca pelo codigo da",
  "  placa ou modelo e ative o arquivo certo; se nao existir, diga isso e trabalhe com",
  "  conhecimento geral e pesquisa na web, deixando claro o que e inferencia.",
  "- Mantenha o caso registrado: quando o tecnico informar uma medicao, grave-a com",
  "  registrar_medicao; registre hipoteses com evidencias, e fortaleca, enfraqueca,",
  "  descarte ou confirme as existentes conforme os resultados; mantenha o resumo do",
  "  caso atualizado quando o quadro mudar. Nunca registre como medido algo que o",
  "  tecnico nao mediu.",
  "- Use a busca na web para datasheets, pinouts, service manuals e falhas conhecidas",
  "  do modelo/placa quando isso mudar a decisao. Cite a fonte de forma curta.",
  "- Nao invente medicoes, nets, referencias ou tensoes. Se faltar um dado critico,",
  "  peca a medicao especifica que resolve a duvida.",
  "- Voce tem a conversa inteira deste caso, incluindo as consultas que ja fez e os",
  "  resultados delas. Use o que ja foi apurado: nao refaca consultas cujo resultado",
  "  ja esta na conversa, nao peca de novo uma medicao que o tecnico ja informou e",
  "  respeite a condicao em que cada medicao foi feita (fonte/bateria plugadas, placa",
  "  ligada ou nao). Se dois dados parecerem conflitar, aponte qual e qual em vez de",
  "  pedir tudo de novo.",
  "- Mensagens de sistema com o ESTADO ATUAL DO CASO trazem os registros do sistema",
  "  naquele momento; a mais recente vale sobre as anteriores.",
  "- Se o estado do caso nao traz o equipamento (sem modelo) e o tecnico disser marca/",
  "  modelo/placa, ou voce ler com certeza na foto da etiqueta, registre com",
  "  atualizar_equipamento_do_caso. Corrija se o tecnico corrigir. Nunca chute modelo.",
  "- Pense na seguranca da placa e do tecnico: avise antes de passos com risco",
  "  (injetar tensao, retirar componente, aplicar calor perto de conectores/BGA).",
  "",
  "Formato da resposta: mensagem de chat em portugues do Brasil, direta, sem",
  "preambulo nem checklist generico repetido. Comece pelo que mudou com a",
  "informacao nova (e pelo que voce observa nas fotos, se houver), depois o",
  "raciocinio em poucas linhas e o proximo passo concreto. Listas curtas quando",
  "ajudarem; nada de JSON ou formulario.",
].join("\n");

function buildCaseBrief(
  context: DiagnosticAssistantContext,
  workbench: DiagnosticTechnicalWorkbench,
  similarCases: Array<{ title: string; excerpt: string; similarityLabel: string }>,
  relatedDocuments: Array<{ title: string; excerpt: string; similarityLabel: string }>,
): string {
  const lines: string[] = [
    "ESTADO ATUAL DO CASO registrado no sistema (nao repita este bloco ao tecnico, e so para sua orientacao):",
    `Equipamento: ${context.label} | Categoria: ${context.category} | Fabricante: ${context.manufacturer} | Modelo: ${context.model}`,
    `Relato inicial: ${context.initialReport}`,
    `Resumo atual do caso: ${context.summary}`,
    `Condicao fisica observada: ${context.physicalNotes}`,
  ];

  if (context.equipmentDetails.length) {
    lines.push(
      `Detalhes do equipamento: ${context.equipmentDetails
        .map((item) => `${item.label}: ${item.value}`)
        .join("; ")}.`,
    );
  }

  lines.push(
    context.symptoms.length
      ? `Sintomas registrados: ${context.symptoms
          .map((item) => `${item.name}${item.isPrimary ? " (principal)" : ""}${item.severity ? ` [${item.severity}]` : ""}`)
          .join("; ")}.`
      : "Nenhum sintoma estruturado registrado ainda.",
  );

  lines.push(
    context.tests.length
      ? `Testes ja executados: ${context.tests
          .map(
            (item) =>
              `${item.testName} (${item.resultStatus}${item.actualResult ? `, resultado: ${item.actualResult}` : ""}${item.conclusion ? `, conclusao: ${item.conclusion}` : ""})`,
          )
          .join("; ")}.`
      : "Nenhum teste registrado ainda.",
  );

  lines.push(
    context.measurements.length
      ? `Medicoes registradas (use consultar_registros_do_caso para a lista completa e em ordem): ${context.measurements
          .slice(0, 15)
          .map(
            (item) =>
              `${item.measurementType} em ${item.pointLabel ?? "ponto nao informado"} = ${item.measuredValueText ?? item.measuredValueNumeric ?? "?"}${item.unit ? ` ${item.unit}` : ""}${item.expectedValueText ? ` (esperado: ${item.expectedValueText})` : ""}`,
          )
          .join("; ")}.`
      : "Nenhuma medicao registrada ainda.",
  );

  lines.push(
    context.hypotheses.length
      ? `Hipoteses ja levantadas: ${context.hypotheses
          .map((item) => `${item.title} (status: ${item.status}${item.confidenceScore !== null ? `, confianca ${item.confidenceScore}` : ""})`)
          .join("; ")}.`
      : "Nenhuma hipotese registrada ainda.",
  );

  lines.push(
    context.technicalAssets.length
      ? `Arquivos tecnicos associados a este caso: ${context.technicalAssets
          .map((item) => `${item.title} (${item.fileFormat.toUpperCase()})`)
          .join("; ")}.`
      : "Nenhum boardview ou esquema associado a este caso ainda.",
  );

  const activeBoardview = workbench.getActiveAsset("boardview");
  const activeSchematic = workbench.getActiveAsset("schematic");
  lines.push(
    `Boardview ativo para consulta: ${activeBoardview ? activeBoardview.title : "nenhum"} | Esquema ativo: ${activeSchematic ? activeSchematic.title : "nenhum"}.`,
  );

  if (similarCases.length) {
    lines.push(
      `Casos semelhantes ja resolvidos: ${similarCases
        .slice(0, 3)
        .map((item) => `${item.title} (${item.similarityLabel})`)
        .join("; ")}.`,
    );
  }

  if (relatedDocuments.length) {
    lines.push(
      `Documentos tecnicos relacionados: ${relatedDocuments
        .slice(0, 3)
        .map((item) => `${item.title} (${item.similarityLabel})`)
        .join("; ")}.`,
    );
  }

  return lines.join("\n");
}

export async function sendDiagnosticChatMessage(
  diagnosticId: string,
  userMessage: string,
  newAttachments: NewChatAttachment[],
  userId: string,
  options: {
    deep?: boolean;
    /** Identifica a pergunta entre tentativas, para o reenvio nao duplicar. */
    clientMessageId?: string;
    /** Reenvio: a pergunta ja foi gravada; so falta a resposta. */
    existingUserResponseId?: string;
    onProgress?: (event: ClaudeChatProgressEvent) => void;
  } = {},
): Promise<{ replyText: string; wroteToCase: boolean }> {
  if (!isClaudeChatConfigured()) {
    throw new Error(
      "O chat de diagnóstico com IA (Claude) ainda não está configurado. Adicione a variável ANTHROPIC_API_KEY.",
    );
  }

  const supabase = await createClient();
  const context = await getDiagnosticAssistantContext(diagnosticId, supabase, userMessage || null);

  if (!context) {
    throw new Error("Diagnóstico não encontrado para o chat.");
  }

  const workbench = await openDiagnosticTechnicalWorkbench(
    diagnosticId,
    supabase as unknown as AssistantTechnicalContextSupabaseClient,
  );

  const { similarCases, relatedDocuments } = await getSimilarCasesAndDocuments(context, supabase);

  const specialist = getSpecialistAgent(context.category, context.manufacturer);

  const trimmedMessage = userMessage.trim();
  const userRawText = trimmedMessage || "(enviou anexo sem mensagem de texto)";

  let userResponseId = options.existingUserResponseId;

  if (!userResponseId) {
    const { data: insertedUserResponse, error: insertUserError } = await supabase
      .from("ai_responses")
      .insert({
        diagnostic_id: diagnosticId,
        prompt_context_version: "chat-v1",
        response_role: "user",
        raw_response_text: userRawText,
        structured_response_json: {
          attachmentCount: newAttachments.length,
          ...(options.clientMessageId ? { clientMessageId: options.clientMessageId } : {}),
        },
        model_name: "technician-input",
      })
      .select("id")
      .single();

    if (insertUserError || !insertedUserResponse) {
      throw insertUserError ?? new Error("Falha ao registrar a mensagem no caso.");
    }

    userResponseId = insertedUserResponse.id as string;
  }

  if (newAttachments.length && !options.existingUserResponseId) {
    await supabase
      .from("attachments")
      .update({ chat_ai_response_id: userResponseId })
      .in(
        "id",
        newAttachments.map((item) => item.id),
      );
  }

  const thread = await loadChatThread(supabase, diagnosticId, userResponseId);
  const caseBrief = buildCaseBrief(context, workbench, similarCases, relatedDocuments);
  const caseBriefHash = createHash("sha256").update(caseBrief).digest("hex");

  const newMessages: ChatMessage[] = [
    {
      role: "user",
      content: await buildChatUserContent(
        userRawText,
        newAttachments.map((item) => ({ mimeType: item.mimeType, base64: item.base64 })),
      ),
    },
  ];
  // O estado do caso vai como mensagem de sistema depois da pergunta, e so
  // quando mudou: as instrucoes fixas no topo nunca mudam (cache) e a conversa
  // guardada nunca e editada, so cresce.
  if (caseBriefHash !== thread.caseBriefHash) {
    newMessages.push({ role: "system", content: caseBrief });
  }

  const actions: string[] = [];
  const wroteToCase = { value: false };

  const agentArgs = {
    stableSystemPrompt: [PERSONA_PROMPT, "", specialist.systemInstructions].join("\n"),
    history: thread.messages,
    newMessages,
    toolContext: { diagnosticId, userId, supabase, workbench, actions, wroteToCase },
    deep: options.deep,
    onProgress: options.onProgress,
  };

  let result: Awaited<ReturnType<typeof runClaudeDiagnosticAgent>>;
  let fallbackReason: string | null = null;
  try {
    try {
      result = await runClaudeDiagnosticAgent(agentArgs);
    } catch (error) {
      // So refaz se nada foi executado ainda (nao registrar medicao duas vezes).
      if (!(error instanceof Anthropic.BadRequestError) || actions.length || wroteToCase.value) {
        throw error;
      }
      // Rede de protecao: se a API recusar o pedido com a conversa completa,
      // responde com a conversa em texto simples (como antes) em vez de falhar.
      fallbackReason = error.message.slice(0, 400);
      console.error("[chat] conversa completa recusada pela API; usando modo de seguranca:", fallbackReason);
      const safeResult = await runClaudeDiagnosticAgent({
        ...agentArgs,
        history: toPlainTextHistory(thread.messages),
        newMessages: [
          {
            role: "user",
            content: await buildChatUserContent(
              `${newMessages.length > 1 ? `${caseBrief}\n\n---\n\n` : ""}${userRawText}`,
              newAttachments.map((item) => ({ mimeType: item.mimeType, base64: item.base64 })),
              { inline: true },
            ),
          },
        ],
        safeMode: true,
      });
      // Guarda so a pergunta original e o texto da resposta: a conversa
      // guardada continua so crescendo, sem os blocos do modo de seguranca.
      result = {
        ...safeResult,
        appendedMessages: [
          ...newMessages,
          { role: "assistant", content: [{ type: "text", text: safeResult.replyText }] },
        ],
      };
    }
  } catch (error) {
    // Guarda a pergunta mesmo sem resposta, para a IA saber o que foi dito.
    await saveChatThread(supabase, diagnosticId, caseBriefHash, [
      ...thread.messages,
      ...newMessages,
      {
        role: "assistant",
        content: [{ type: "text", text: "(A resposta a esta mensagem falhou por erro técnico e não chegou ao técnico.)" }],
      },
    ]).catch(() => undefined);
    throw error;
  }

  const replyText = stripNulChars(result.replyText);
  let threadSaveIssue: string | null = null;

  try {
    await saveChatThread(supabase, diagnosticId, caseBriefHash, [
      ...thread.messages,
      ...result.appendedMessages,
    ]);
  } catch (error) {
    // A resposta ja existe: nunca perde-la por falha ao guardar a conversa
    // completa. Guarda so a pergunta e o texto da resposta (continua so
    // crescendo) e segue. Em 16/10 uma resposta pronta se perdeu aqui.
    threadSaveIssue = error instanceof Error ? error.message.slice(0, 300) : String(error);
    console.error("[chat] falha ao guardar a conversa completa; guardando so o texto:", threadSaveIssue);
    await saveChatThread(supabase, diagnosticId, caseBriefHash, [
      ...thread.messages,
      ...newMessages,
      { role: "assistant", content: [{ type: "text", text: replyText }] },
    ]).catch((fallbackError) => console.error("[chat] falha tambem ao guardar so o texto:", fallbackError));
  }

  const { error: insertAssistantError } = await supabase.from("ai_responses").insert({
    diagnostic_id: diagnosticId,
    prompt_context_version: "chat-v1",
    response_role: "assistant",
    raw_response_text: replyText,
    structured_response_json: {
      provider: "claude",
      ...(threadSaveIssue ? { threadSaveIssue } : {}),
      sourcesUsed: result.sourcesUsed.map(stripNulChars),
      modelName: result.modelName,
      agentActions: actions,
      memoryMode: fallbackReason ? "fallback" : "full",
      ...(fallbackReason ? { memoryFallbackReason: fallbackReason } : {}),
    },
    model_name: result.modelName,
    tokens_input: result.tokensInput || null,
    tokens_output: result.tokensOutput || null,
  });

  if (insertAssistantError) {
    throw insertAssistantError;
  }

  return { replyText, wroteToCase: wroteToCase.value };
}

/**
 * O Postgres recusa o caractere nulo (\u0000) em texto e jsonb. Ele aparece em
 * PDFs baixados pela IA (datasheets via web_fetch) e em textos extraidos.
 */
function stripNulChars(value: string) {
  return value.replace(/\u0000/g, "");
}

function stripNulDeep<T>(value: T): T {
  if (typeof value === "string") {
    return stripNulChars(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(stripNulDeep) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, stripNulDeep(item)]),
    ) as T;
  }
  return value;
}

type ChatSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Conversa guardada reduzida a texto (sem consultas, raciocinio nem mensagens
 * de sistema), para o modo de seguranca. Fotos viram uma nota.
 */
function toPlainTextHistory(messages: ChatMessage[]): ChatMessage[] {
  const plain: ChatMessage[] = [];

  for (const message of messages) {
    const blocks = typeof message.content === "string" ? [{ type: "text", text: message.content }] : message.content;
    const parts: string[] = [];
    for (const block of blocks) {
      if (block.type === "text" && "text" in block && block.text.trim()) {
        parts.push(block.text);
      } else if (block.type === "image") {
        parts.push("(foto anexada)");
      }
    }
    if (!parts.length) {
      continue;
    }

    const role = message.role === "assistant" ? "assistant" : "user";
    const text = message.role === "system" ? `[Estado do caso naquele momento]\n${parts.join("\n")}` : parts.join("\n");
    plain.push({ role, content: [{ type: "text", text }] });
  }

  if (plain[0]?.role === "assistant") {
    plain.unshift({ role: "user", content: [{ type: "text", text: "(inicio da conversa deste caso)" }] });
  }

  return plain;
}

async function saveChatThread(
  supabase: ChatSupabaseClient,
  diagnosticId: string,
  caseBriefHash: string,
  messages: ChatMessage[],
) {
  const { error } = await supabase.from("diagnostic_chat_threads").upsert({
    diagnostic_id: diagnosticId,
    messages: stripNulDeep(messages),
    case_brief_hash: caseBriefHash,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }
}

/**
 * Conversa guardada do caso. Casos anteriores a memoria completa ainda nao tem
 * conversa guardada: ela e montada uma vez a partir das mensagens do chat (so
 * texto) e dai em diante so cresce.
 */
async function loadChatThread(
  supabase: ChatSupabaseClient,
  diagnosticId: string,
  currentUserResponseId: string,
): Promise<{ messages: ChatMessage[]; caseBriefHash: string | null }> {
  const { data: saved } = await supabase
    .from("diagnostic_chat_threads")
    .select("messages, case_brief_hash")
    .eq("diagnostic_id", diagnosticId)
    .maybeSingle();

  if (saved) {
    return {
      messages: (saved.messages as ChatMessage[] | null) ?? [],
      caseBriefHash: (saved.case_brief_hash as string | null) ?? null,
    };
  }

  const { data: historyRows } = await supabase
    .from("ai_responses")
    .select("id, response_role, raw_response_text, structured_response_json, created_at")
    .eq("diagnostic_id", diagnosticId)
    .in("response_role", ["user", "assistant"])
    .neq("id", currentUserResponseId)
    .order("created_at", { ascending: true });

  const historyIds = (historyRows ?? []).map((row) => row.id);
  const { data: historyAttachments } = historyIds.length
    ? await supabase
        .from("attachments")
        .select("chat_ai_response_id, title, ai_image_analysis")
        .in("chat_ai_response_id", historyIds)
    : { data: [] as Array<{ chat_ai_response_id: string | null; title: string; ai_image_analysis: Record<string, unknown> | null }> };

  const attachmentsByResponseId = new Map<string, Array<{ title: string; analysis: Record<string, unknown> | null }>>();
  for (const row of historyAttachments ?? []) {
    if (!row.chat_ai_response_id) continue;
    const list = attachmentsByResponseId.get(row.chat_ai_response_id) ?? [];
    list.push({ title: row.title, analysis: row.ai_image_analysis });
    attachmentsByResponseId.set(row.chat_ai_response_id, list);
  }

  const seeded: ChatMessage[] = (historyRows ?? []).map((row) => {
    const photos = attachmentsByResponseId.get(row.id) ?? [];
    let text = row.raw_response_text ?? "";
    const structured = row.structured_response_json as { agentActions?: unknown } | null;
    const previousActions = Array.isArray(structured?.agentActions)
      ? (structured.agentActions as unknown[]).map(String)
      : [];

    if (previousActions.length) {
      text = `${text}\n(acoes executadas nesta resposta: ${previousActions.join("; ")})`;
    }

    if (photos.length) {
      const photoNotes = photos
        .map((photo) => {
          const observations = Array.isArray(photo.analysis?.observations)
            ? (photo.analysis?.observations as string[]).join("; ")
            : null;
          return observations
            ? `${photo.title}: ${observations}`
            : `${photo.title}: (sem analise registrada)`;
        })
        .join(" | ");
      text = `${text}\n(fotos anexadas nesta mensagem - ${photoNotes})`;
    }

    return {
      role: row.response_role as "user" | "assistant",
      content: [{ type: "text", text: text.trim() || "(mensagem vazia)" }],
    };
  });

  // A conversa precisa comecar pelo tecnico.
  if (seeded[0]?.role === "assistant") {
    seeded.unshift({
      role: "user",
      content: [{ type: "text", text: "(inicio da conversa deste caso)" }],
    });
  }

  return { messages: seeded, caseBriefHash: null };
}
