import { createClient } from "@/lib/supabase/server";
import {
  generateClaudeChatReply,
  isClaudeChatConfigured,
  type ClaudeChatTurn,
} from "@/lib/ai/assistant-llm-claude";
import { getSpecialistAgent } from "@/lib/domain/specialist-agents";
import {
  getDiagnosticAssistantContext,
  getSimilarCasesAndDocuments,
  type DiagnosticAssistantContext,
} from "@/lib/services/assistant";
import {
  type AssistantTechnicalContextSupabaseClient,
  buildTechnicalContextSources,
  searchAssistantTechnicalContext,
  summarizeTechnicalContextForAssistant,
} from "@/lib/services/assistant-technical-context";

export type NewChatAttachment = {
  id: string;
  mimeType: string;
  base64: string;
};

const PERSONA_PROMPT = [
  "Voce e um tecnico eletronico senior de bancada, especialista em manutencao e",
  "diagnostico de placas de computador (placas-mae de desktop e notebook, fontes,",
  "placas de video e perifericos relacionados). Voce esta conversando em um chat,",
  "em tempo real, com um tecnico experiente que ja abriu este caso no sistema.",
  "",
  "Regras de estilo, muito importantes:",
  "- Responda como um colega tecnico experiente responderia no chat: direto, tecnico,",
  "  em portugues do Brasil, sem introducoes genericas nem preambulo.",
  "- NUNCA repita o mesmo roteiro ou checklist generico em toda resposta. Use o",
  "  historico da conversa e o contexto do caso abaixo para avancar o diagnostico a",
  "  cada resposta, em vez de reiniciar a investigacao do zero.",
  "- Va direto ao que importa: o que medir, onde medir, o valor esperado, e o que",
  "  concluir dependendo do resultado. Evite respostas genericas tipo 'verifique a",
  "  fonte de alimentacao' sem contexto especifico do caso.",
  "- Se o tecnico anexou foto(s) nesta mensagem, comente primeiro o que voce",
  "  consegue observar tecnicamente nela(s) (sinais de queima, corrosao, capacitor",
  "  estufado, solda fria, trilha rompida, componente ausente, etc.) antes de",
  "  sugerir o proximo passo.",
  "- Quando precisar de dado externo (datasheet de componente, pinout, service",
  "  manual, ou relatos de falha conhecida para este modelo especifico), use a",
  "  ferramenta de busca na web. Cite a fonte de forma objetiva quando usar.",
  "- Nunca invente sintomas, medicoes, hipoteses ou tensoes que nao estejam",
  "  sustentados pelo contexto do caso ou pela pesquisa feita.",
  "- Se faltar um dado critico para avancar, faca uma pergunta objetiva e pontual.",
  "- Nao force um formato fixo de resposta. Escreva como uma mensagem de chat",
  "  normal (paragrafos curtos e, quando fizer sentido, uma lista curta), nunca",
  "  como um formulario ou JSON.",
].join("\n");

function buildCaseBrief(
  context: DiagnosticAssistantContext,
  technicalContextSummary: string | null,
  technicalSources: string[],
  similarCases: Array<{ title: string; excerpt: string; similarityLabel: string }>,
  relatedDocuments: Array<{ title: string; excerpt: string; similarityLabel: string }>,
): string {
  const lines: string[] = [
    "CONTEXTO ATUAL DO CASO (nao repita este bloco ao tecnico, e so para sua orientacao):",
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
      ? `Medicoes registradas: ${context.measurements
          .slice(0, 10)
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

  if (technicalContextSummary) {
    lines.push(`Achados tecnicos (boardview/esquema) ja consultados: ${technicalContextSummary}`);
  }

  if (technicalSources.length) {
    lines.push(`Fontes tecnicas ja usadas neste caso: ${technicalSources.slice(0, 6).join("; ")}.`);
  }

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
): Promise<{ replyText: string }> {
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

  const technicalContextClient = supabase as unknown as AssistantTechnicalContextSupabaseClient;
  const technicalContext = await searchAssistantTechnicalContext({
    diagnosticId,
    benchPrompt: userMessage || null,
    contextSources: {
      summary: context.summary,
      initialReport: context.initialReport,
      symptoms: context.symptoms.map((item) => `${item.name} ${item.notes ?? ""}`),
      measurements: context.measurements.flatMap((item) => [
        item.pointLabel,
        item.measuredValueText,
        item.expectedValueText,
        item.context,
        item.observation,
        ...item.inferredTerms,
      ]),
      hypotheses: context.hypotheses.map((item) => `${item.title} ${item.evidenceSummary ?? ""}`),
      tests: context.tests.map(
        (item) =>
          `${item.testName} ${item.resultStatus} ${item.actualResult ?? ""} ${item.conclusion ?? ""}`,
      ),
      recentHistory: context.recentAssistantHistory.map((item) => `${item.role} ${item.summary}`),
      attachments: context.attachments.map((item) => `${item.title} ${item.description ?? ""} ${item.summary}`),
      assetNames: context.technicalAssets.map((item) => item.title),
    },
    supabase: technicalContextClient,
  });

  const { similarCases, relatedDocuments } = await getSimilarCasesAndDocuments(context, supabase);

  const technicalContextSummary = summarizeTechnicalContextForAssistant(technicalContext);
  const technicalSources = buildTechnicalContextSources(technicalContext);
  const specialist = getSpecialistAgent(context.category, context.manufacturer);

  const trimmedMessage = userMessage.trim();
  const userRawText = trimmedMessage || "(enviou anexo sem mensagem de texto)";

  const { data: insertedUserResponse, error: insertUserError } = await supabase
    .from("ai_responses")
    .insert({
      diagnostic_id: diagnosticId,
      prompt_context_version: "chat-v1",
      response_role: "user",
      raw_response_text: userRawText,
      structured_response_json: { attachmentCount: newAttachments.length },
      model_name: "technician-input",
    })
    .select("id")
    .single();

  if (insertUserError || !insertedUserResponse) {
    throw insertUserError ?? new Error("Falha ao registrar a mensagem no caso.");
  }

  const userResponseId = insertedUserResponse.id as string;

  if (newAttachments.length) {
    await supabase
      .from("attachments")
      .update({ chat_ai_response_id: userResponseId })
      .in(
        "id",
        newAttachments.map((item) => item.id),
      );
  }

  // Historico completo do chat deste caso, em ordem cronologica, incluindo a
  // mensagem que acabamos de inserir.
  const { data: historyRows } = await supabase
    .from("ai_responses")
    .select("id, response_role, raw_response_text, created_at")
    .eq("diagnostic_id", diagnosticId)
    .in("response_role", ["user", "assistant"])
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

  const turns: ClaudeChatTurn[] = (historyRows ?? []).map((row) => {
    const isCurrentTurn = row.id === userResponseId;
    const photos = attachmentsByResponseId.get(row.id) ?? [];
    let text = row.raw_response_text ?? "";

    if (photos.length && !isCurrentTurn) {
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
      text,
      images: isCurrentTurn
        ? newAttachments.map((item) => ({ mimeType: item.mimeType, base64: item.base64 }))
        : undefined,
    };
  });

  const caseBrief = buildCaseBrief(
    context,
    technicalContextSummary || null,
    technicalSources,
    similarCases,
    relatedDocuments,
  );

  const systemPrompt = [PERSONA_PROMPT, "", specialist.systemInstructions, "", caseBrief].join("\n");

  const result = await generateClaudeChatReply({ systemPrompt, turns });

  const { error: insertAssistantError } = await supabase.from("ai_responses").insert({
    diagnostic_id: diagnosticId,
    prompt_context_version: "chat-v1",
    response_role: "assistant",
    raw_response_text: result.replyText,
    structured_response_json: {
      provider: "claude",
      sourcesUsed: result.sourcesUsed,
      modelName: result.modelName,
    },
    model_name: result.modelName,
    tokens_input: result.tokensInput || null,
    tokens_output: result.tokensOutput || null,
  });

  if (insertAssistantError) {
    throw insertAssistantError;
  }

  return { replyText: result.replyText };
}
