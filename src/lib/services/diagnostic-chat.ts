import { createClient } from "@/lib/supabase/server";
import {
  isClaudeChatConfigured,
  runClaudeDiagnosticAgent,
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
  type DiagnosticTechnicalWorkbench,
  openDiagnosticTechnicalWorkbench,
} from "@/lib/services/assistant-technical-context";

export type NewChatAttachment = {
  id: string;
  mimeType: string;
  base64: string;
};

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
    .select("id, response_role, raw_response_text, structured_response_json, created_at")
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
    const structured = row.structured_response_json as { agentActions?: unknown } | null;
    const previousActions = Array.isArray(structured?.agentActions)
      ? (structured.agentActions as unknown[]).map(String)
      : [];

    if (previousActions.length) {
      text = `${text}
(acoes executadas nesta resposta: ${previousActions.join("; ")})`;
    }

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

  const caseBrief = buildCaseBrief(context, workbench, similarCases, relatedDocuments);
  const actions: string[] = [];
  const wroteToCase = { value: false };

  const result = await runClaudeDiagnosticAgent({
    stableSystemPrompt: [PERSONA_PROMPT, "", specialist.systemInstructions].join("\n"),
    caseSystemPrompt: caseBrief,
    turns,
    toolContext: { diagnosticId, userId, supabase, workbench, actions, wroteToCase },
  });

  const { error: insertAssistantError } = await supabase.from("ai_responses").insert({
    diagnostic_id: diagnosticId,
    prompt_context_version: "chat-v1",
    response_role: "assistant",
    raw_response_text: result.replyText,
    structured_response_json: {
      provider: "claude",
      sourcesUsed: result.sourcesUsed,
      modelName: result.modelName,
      agentActions: actions,
    },
    model_name: result.modelName,
    tokens_input: result.tokensInput || null,
    tokens_output: result.tokensOutput || null,
  });

  if (insertAssistantError) {
    throw insertAssistantError;
  }

  return { replyText: result.replyText, wroteToCase: wroteToCase.value };
}
