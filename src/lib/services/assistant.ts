import { createClient } from "@/lib/supabase/server";
import {
  formatVectorLiteral,
  generateTextEmbedding,
  getEmbeddingProviderName,
  isExternalEmbeddingConfigured,
} from "@/lib/ai/embeddings";
import {
  generateAssistantNarrative,
  getAssistantModelName,
  isLlmConfigured,
} from "@/lib/ai/assistant-llm";
import {
  type AssistantTechnicalContextSupabaseClient,
  buildTechnicalContextEvidence,
  buildTechnicalContextSources,
  searchAssistantTechnicalContext,
  summarizeTechnicalContextForAssistant,
} from "@/lib/services/assistant-technical-context";
import { getSpecialistAgent } from "@/lib/domain/specialist-agents";
import { formatRelativeTime } from "@/lib/utils";
import type {
  AiFeedbackRating,
  AssistantStructuredResponse,
  DiagnosticDetail,
  SemanticMatchResult,
} from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AssistantSnapshot = DiagnosticDetail["assistantSnapshot"];

export type DiagnosticAssistantContext = {
  id: string;
  label: string;
  summary: string;
  initialReport: string;
  category: string;
  manufacturer: string;
  model: string;
  physicalNotes: string;
  equipmentDetails: Array<{
    label: string;
    value: string;
  }>;
  symptoms: Array<{
    name: string;
    severity: string | null;
    isPrimary: boolean;
    group: string | null;
    notes: string | null;
  }>;
  tests: Array<{
    testId: string | null;
    testName: string;
    testGroup: string | null;
    resultStatus: string;
    stepOrder: number;
    procedureNotes: string | null;
    expectedResult: string | null;
    actualResult: string | null;
    conclusion: string | null;
  }>;
  measurements: Array<{
    measurementType: string;
    pointLabel: string | null;
    measuredValueNumeric: number | null;
    measuredValueText: string | null;
    expectedValueText: string | null;
    unit: string | null;
    context: string | null;
    toleranceText: string | null;
    observation: string | null;
    inferredTerms: string[];
  }>;
  hypotheses: Array<{
    title: string;
    description: string | null;
    evidenceSummary: string | null;
    confidenceScore: number | null;
    status: string;
  }>;
  technicalAssets: Array<{
    id: string;
    title: string;
    assetType: string;
    fileFormat: string;
    boardName: string | null;
    modelName: string | null;
  }>;
  recentAssistantHistory: Array<{
    role: "user" | "assistant";
    summary: string;
    createdAt: string;
  }>;
  attachments: Array<{
    title: string;
    description: string | null;
    summary: string;
  }>;
  benchPrompt: string | null;
  technicalContextSummary: string | null;
};

type CategoryStrategy = {
  preferredGroups: string[];
  summaryFocus: string;
  firstMove: string;
  safety: string;
};

type AssistantScenario = {
  id: string;
  title: string;
  summary: string;
  firstMeasurements: string[];
  nextChecks: string[];
};

type MeasurementSignal = {
  type:
    | "missing_primary_voltage"
    | "low_consumption"
    | "high_consumption"
    | "short_suspected"
    | "battery_line_issue"
    | "video_power_issue";
  description: string;
};

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function truncate(value: string, maxLength = 220) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trim()}...`;
}

function formatConfidence(value: number) {
  return value.toFixed(2);
}

function formatFeedbackRating(value: AiFeedbackRating) {
  if (value === "helpful") {
    return "helpful";
  }

  if (value === "partially_helpful") {
    return "partially_helpful";
  }

  return "not_helpful";
}

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 4);
}

function normalizeComparable(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isMeaningfulValue(value: string | null | undefined) {
  const normalized = normalizeComparable(value);
  return normalized.length > 0 && normalized !== "naoinformado" && normalized !== "naoidentificado";
}

function getNarrativeProviderName(modelName: string) {
  return modelName === "heuristic-v1" ? "Modo local (fallback heuristico)" : "IA externa (OpenAI)";
}

function formatEquipmentDetailValue(
  key: string,
  value: string | number | boolean,
) {
  if (typeof value === "boolean") {
    return value ? "Sim" : "Nao";
  }

  if (key === "screenCondition") {
    if (value === "good") {
      return "Boa";
    }

    if (value === "broken") {
      return "Quebrada";
    }

    if (value === "no_image") {
      return "Sem imagem";
    }
  }

  return String(value);
}

function buildEquipmentDetailItemsForAssistant(
  details: Record<string, unknown> | null | undefined,
) {
  if (!details) {
    return [];
  }

  const labels: Record<string, string> = {
    manufacturingYear: "Ano de fabricacao",
    accessoriesIncluded: "Acessorios",
    powerPresent: "Alimentacao",
    powersOn: "Liga",
    screenCondition: "Condicao da tela",
    tvScreenSizeInches: "Tela",
    tvScreenType: "Tipo de tela",
    tvKind: "Tipo de TV",
    tvResolution: "Resolucao",
    tvPanelCode: "Codigo do painel",
    notebookProcessor: "Processador",
    notebookRamGb: "RAM",
    notebookStorageType: "Armazenamento",
    notebookStorageCapacityGb: "Capacidade",
    notebookScreenSizeInches: "Tela notebook",
    notebookChargerIncluded: "Carregador",
    smartphoneStorageGb: "Armazenamento smartphone",
    smartphoneColor: "Cor",
    smartphoneDualSim: "Dual SIM",
    smartphoneBiometric: "Biometria",
    smartphoneNetworkType: "Rede",
    desktopProcessor: "Processador desktop",
    desktopRamGb: "RAM desktop",
    desktopStorageType: "Armazenamento desktop",
    desktopStorageCapacityGb: "Capacidade desktop",
    desktopDedicatedGpu: "GPU dedicada",
    desktopPsuWatts: "Fonte",
  };

  return Object.entries(details)
    .filter(
      ([, value]) =>
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean",
    )
    .map(([key, value]) => ({
      label: labels[key] ?? key,
      value: formatEquipmentDetailValue(key, value as string | number | boolean),
    }));
}

function inferMeasurementTerms(
  measurement: Pick<
    DiagnosticAssistantContext["measurements"][number],
    | "pointLabel"
    | "measuredValueText"
    | "expectedValueText"
    | "context"
    | "observation"
  >,
) {
  const tokens = [
    measurement.pointLabel,
    measurement.measuredValueText,
    measurement.expectedValueText,
    measurement.context,
    measurement.observation,
  ]
    .join(" ")
    .toUpperCase()
    .match(/\b(?:[A-Z]{1,4}\d{2,6}|PP[A-Z0-9_+\-/.]+|SMC[A-Z0-9_+\-/.]*|PM[A-Z0-9_+\-/.]*|G3H[A-Z0-9_+\-/.]*|S5[A-Z0-9_+\-/.]*|S4[A-Z0-9_+\-/.]*|SUS[A-Z0-9_+\-/.]*|AUX[A-Z0-9_+\-/.]*|\d{1,2}(?:\.\d+)?V)\b/g);

  return Array.from(new Set((tokens ?? []).slice(0, 8)));
}

function inferMeasurementSignals(context: DiagnosticAssistantContext): MeasurementSignal[] {
  const signals: MeasurementSignal[] = [];

  for (const measurement of context.measurements) {
    const point = normalizeComparable(measurement.pointLabel);
    const measuredText = normalizeComparable(measurement.measuredValueText);
    const expectedText = normalizeComparable(measurement.expectedValueText);
    const unit = normalizeComparable(measurement.unit);
    const numeric = measurement.measuredValueNumeric;
    const type = normalizeComparable(measurement.measurementType);

    if (
      type === "voltage" &&
      numeric !== null &&
      numeric < 1 &&
      (point.includes("3v") || point.includes("3p3") || point.includes("5v") || point.includes("alw"))
    ) {
      signals.push({
        type: "missing_primary_voltage",
        description: `Tensão primária baixa/ausente em ${measurement.pointLabel ?? "ponto não informado"}.`,
      });
    }

    if ((type === "consumption" || type === "current") && numeric !== null && numeric <= 0.03) {
      signals.push({
        type: "low_consumption",
        description: `Consumo muito baixo registrado (${numeric}${measurement.unit ? ` ${measurement.unit}` : ""}).`,
      });
    }

    if ((type === "consumption" || type === "current") && numeric !== null && numeric >= 0.4) {
      signals.push({
        type: "high_consumption",
        description: `Consumo elevado registrado (${numeric}${measurement.unit ? ` ${measurement.unit}` : ""}).`,
      });
    }

    if (
      type === "resistance" &&
      numeric !== null &&
      numeric <= 5 &&
      (unit === "ohm" || unit === "r" || unit === "ω" || unit === "")
    ) {
      signals.push({
        type: "short_suspected",
        description: `Baixa resistência em ${measurement.pointLabel ?? "ponto não informado"}, suspeita de curto.`,
      });
    }

    if (
      point.includes("bat") ||
      point.includes("batt") ||
      expectedText.includes("bat") ||
      measuredText.includes("bateria")
    ) {
      signals.push({
        type: "battery_line_issue",
        description: `Medição relacionada à linha da bateria em ${measurement.pointLabel ?? "ponto não informado"}.`,
      });
    }

    if (
      point.includes("lcd") ||
      point.includes("edp") ||
      point.includes("lvds") ||
      point.includes("backlight")
    ) {
      signals.push({
        type: "video_power_issue",
        description: `Medição associada à alimentação de vídeo/tela em ${measurement.pointLabel ?? "ponto não informado"}.`,
      });
    }
  }

  return signals;
}

function inferAssistantScenario(context: DiagnosticAssistantContext): AssistantScenario {
  const signalText = normalizeComparable(
    [context.summary, context.initialReport, ...context.symptoms.map((item) => item.name)].join(" "),
  );
  const measurementSignals = inferMeasurementSignals(context);

  const scenarios: AssistantScenario[] = [
    {
      id: "nao-liga",
      title: "Notebook não liga",
      summary: "Começar por consumo e tensões primárias antes de suspeitar de BIOS, SIO ou PCH.",
      firstMeasurements: [
        "Consumo na fonte assimétrica em standby e ao pressionar power",
        "Tensão de entrada VIN / DC-IN",
        "3.3V_ALW e 5V_ALW",
        "Sinal do botão power e sequência de start",
      ],
      nextChecks: [
        "Se faltar ALW, seguir primário e habilitação",
        "Se houver ALW mas sem start, seguir EC/SIO e sinais de power",
      ],
    },
    {
      id: "sem-video",
      title: "Liga sem vídeo",
      summary: "Separar cedo se a falha está em tela, backlight, RAM, BIOS ou geração de vídeo.",
      firstMeasurements: [
        "Tensões secundárias após start",
        "Teste em monitor externo",
        "Alimentação da tela e backlight",
        "Reset, clock, BIOS e RAM",
      ],
      nextChecks: [
        "Se houver vídeo externo, isolar tela ou flat",
        "Se não houver vídeo em nenhuma saída, seguir BIOS, RAM e chipset",
      ],
    },
    {
      id: "nao-carrega-bateria",
      title: "Não carrega bateria",
      summary: "Focar no circuito charger e na detecção da bateria antes de trocas sem medição.",
      firstMeasurements: [
        "Entrada da fonte e charger",
        "Linha BAT+",
        "Mosfets do charger",
        "Sinais ACOK, CMSRC e REGN",
      ],
      nextChecks: [
        "Se REGN/ACOK faltarem, seguir charger e habilitação",
        "Se BAT+ não subir, verificar charger, mosfets e comunicação da bateria",
      ],
    },
    {
      id: "consumo-alto",
      title: "Consumo alto",
      summary: "Usar consumo e aquecimento para localizar a linha suspeita antes de aprofundar.",
      firstMeasurements: [
        "Perfil de consumo em standby e no start",
        "Aquecimento anormal por inspeção",
        "Resistência nas bobinas principais",
        "Injeção controlada na linha suspeita",
      ],
      nextChecks: [
        "Confrontar o ponto quente com esquema/boardview",
        "Registrar a linha suspeita antes da próxima recomendação",
      ],
    },
    {
      id: "curto-na-linha",
      title: "Curto na linha",
      summary: "Medir resistência e isolar a linha em curto antes de insistir em start.",
      firstMeasurements: [
        "Resistência para terra nas linhas principais",
        "Comparação entre bobinas e rails críticos",
        "Injeção com corrente limitada",
        "Componente que aquece primeiro",
      ],
      nextChecks: [
        "Usar esquema/boardview para rastrear a linha em curto",
        "Registrar o componente suspeito e pedir nova análise",
      ],
    },
  ];

  if (
    signalText.includes("naoliga") ||
    signalText.includes("semligar") ||
    signalText.includes("sempower") ||
    signalText.includes("semstart") ||
    signalText.includes("nopower")
  ) {
    return scenarios[0];
  }

  if (measurementSignals.some((item) => item.type === "video_power_issue")) {
    return scenarios[1];
  }

  if (
    signalText.includes("semvideo") ||
    signalText.includes("semimagem") ||
    signalText.includes("ligasemvideo") ||
    signalText.includes("ligasemimagem")
  ) {
    return scenarios[1];
  }

  if (signalText.includes("bateria") || signalText.includes("carrega")) {
    return scenarios[2];
  }

  if (measurementSignals.some((item) => item.type === "battery_line_issue")) {
    return scenarios[2];
  }

  if (
    signalText.includes("curto") ||
    signalText.includes("linhaemcurto") ||
    signalText.includes("resistenciabaixa")
  ) {
    return scenarios[4];
  }

  if (measurementSignals.some((item) => item.type === "short_suspected")) {
    return scenarios[4];
  }

  if (
    signalText.includes("consumoalto") ||
    signalText.includes("consumoelevado") ||
    signalText.includes("aquecendo") ||
    signalText.includes("esquenta")
  ) {
    return scenarios[3];
  }

  if (measurementSignals.some((item) => item.type === "high_consumption")) {
    return scenarios[3];
  }

  if (
    measurementSignals.some(
      (item) => item.type === "missing_primary_voltage" || item.type === "low_consumption",
    )
  ) {
    return scenarios[0];
  }

  return scenarios[0];
}

function resolveCategoryStrategy(category: string): CategoryStrategy {
  const normalized = category.toLowerCase();

  if (normalized.includes("notebook")) {
    return {
      preferredGroups: ["power", "electrical", "firmware"],
      summaryFocus:
        "Para notebook, a recomendação deve separar cedo alimentação primária, sequência de start e corrupção de firmware antes de trocas amplas.",
      firstMove:
        "Priorizar consumo em fonte assimétrica, tensões primárias e confirmação de etapas de start.",
      safety:
        "Remover bateria quando aplicável e registrar consumo inicial antes de insistir no power.",
    };
  }

  if (normalized.includes("television")) {
    return {
      preferredGroups: ["power", "electrical", "replacement"],
      summaryFocus:
        "Para televisão, a recomendação deve isolar fonte, backlight, T-Con e trilha de vídeo com foco em blocos funcionais.",
      firstMove:
        "Separar cedo se a falha está em energia, painel ou processamento de imagem.",
      safety:
        "Cuidado com alta tensão em fonte e backlight antes de medir linhas ativas.",
    };
  }

  if (normalized.includes("smartphone")) {
    return {
      preferredGroups: ["power", "electrical", "replacement"],
      summaryFocus:
        "Para smartphone, a recomendação deve usar consumo, linha de carga e aquecimento como trilhas principais antes de medidas invasivas.",
      firstMove:
        "Priorizar linha VBAT, linha de carga e observação térmica localizada.",
      safety:
        "Evitar energizar sem controlar corrente e temperatura durante testes de bancada.",
    };
  }

  return {
    preferredGroups: ["power", "electrical", "replacement"],
    summaryFocus:
      "Para desktop, a recomendação deve separar fonte, acionamento e vídeo antes de substituir subconjuntos inteiros.",
    firstMove:
      "Confirmar energização, sinais básicos de start e bloco de vídeo com uma etapa objetiva por vez.",
    safety:
      "Registrar terra e linhas principais antes de medição em placas energizadas.",
  };
}

function pickUnperformedTest(
  availableTests: Array<{ id: string; name: string; group: string | null }>,
  executedTests: string[],
  symptomNames: string[],
  preferredGroups: string[],
  groupSuccessRate: Map<string, number>,
) {
  const executed = new Set(executedTests.map((item) => item.toLowerCase()));
  const symptomWords = new Set(symptomNames.flatMap(normalizeWords));

  const ranked = availableTests
    .filter((item) => !executed.has(item.name.toLowerCase()))
    .map((item) => {
      const haystack = `${item.name} ${item.group ?? ""}`.toLowerCase();
      let score = 0;

      if (item.group && preferredGroups.includes(item.group)) {
        score += 3;
      }

      for (const word of symptomWords) {
        if (haystack.includes(word)) {
          score += 1;
        }
      }

      if (item.group) {
        score += (groupSuccessRate.get(item.group) ?? 0) * 2;
      }

      return {
        id: item.id,
        name: item.name,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return ranked[0] ?? availableTests[0] ?? null;
}

async function getHistoricalTestGroupSuccess(supabase: SupabaseServerClient) {
  const { data } = await supabase
    .from("diagnostic_test_runs")
    .select(
      `
        tests(test_group),
        ai_responses(
          ai_response_feedback(feedback_rating, was_followed)
        )
      `,
    )
    .not("requested_by_ai_response_id", "is", null);

  const totals = new Map<string, { success: number; total: number }>();

  for (const row of
    ((data ?? []) as Array<{
      tests: { test_group: string | null } | Array<{ test_group: string | null }> | null;
      ai_responses:
        | {
            ai_response_feedback:
              | { feedback_rating: string; was_followed: boolean | null }
              | Array<{ feedback_rating: string; was_followed: boolean | null }>
              | null;
          }
        | Array<{
            ai_response_feedback:
              | { feedback_rating: string; was_followed: boolean | null }
              | Array<{ feedback_rating: string; was_followed: boolean | null }>
              | null;
          }>
        | null;
    }>)) {
    const group = pickRelation(row.tests)?.test_group;

    if (!group) {
      continue;
    }

    const response = pickRelation(row.ai_responses);
    const feedback = response ? pickRelation(response.ai_response_feedback) : null;
    const entry = totals.get(group) ?? { success: 0, total: 0 };

    entry.total += 1;

    if (feedback && (feedback.was_followed === true || feedback.feedback_rating === "helpful")) {
      entry.success += 1;
    }

    totals.set(group, entry);
  }

  const rateMap = new Map<string, number>();

  for (const [group, { success, total }] of totals) {
    rateMap.set(group, total > 0 ? success / total : 0);
  }

  return rateMap;
}

async function getDiagnosticAssistantContext(
  diagnosticId: string,
  supabase: SupabaseServerClient,
  benchPrompt: string | null,
): Promise<DiagnosticAssistantContext | null> {
  const { data } = await supabase
    .from("diagnostics")
    .select(
      `
        id,
        equipment_label,
        current_summary,
        initial_problem_report,
        physical_condition_notes,
        equipment_details,
        equipment_model_id,
        equipment_categories(name),
        manufacturers(name),
        equipment_models(model_name),
        diagnostic_boards(board_id, boards(board_code)),
        diagnostic_symptoms(severity, notes, is_primary, symptoms(name, symptom_group)),
        diagnostic_test_runs(step_order, result_status, procedure_notes, expected_result, actual_result, conclusion, tests(id, name, test_group)),
        measurements(measurement_type, point_label, measured_value_numeric, measured_value_text, expected_value_text, unit, measurement_context, tolerance_text),
        hypotheses(title, description, evidence_summary, confidence_score, status)
      `,
    )
    .eq("id", diagnosticId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const category = pickRelation(data.equipment_categories);
  const manufacturer = pickRelation(data.manufacturers);
  const model = pickRelation(data.equipment_models);
  const boardIds = (data.diagnostic_boards ?? [])
    .map((item) => item.board_id)
    .filter((value): value is string => Boolean(value));
  const technicalAssetLinkFilters: string[] = [];

  if (data.equipment_model_id) {
    technicalAssetLinkFilters.push(`equipment_model_id.eq.${data.equipment_model_id}`);
  }

  if (boardIds.length) {
    technicalAssetLinkFilters.push(`board_id.in.(${boardIds.join(",")})`);
  }

  const technicalAssetLinksResult = technicalAssetLinkFilters.length
    ? await supabase
        .from("technical_asset_links")
        .select(
          `
            board_id,
            equipment_model_id,
            boards(board_code),
            equipment_models(model_name),
            technical_assets(id, original_filename, asset_type, file_format)
          `,
        )
        .or(technicalAssetLinkFilters.join(","))
    : { data: [] as Array<Record<string, unknown>> };
  const [recentResponsesResult, attachmentsResult] = await Promise.all([
    supabase
      .from("ai_responses")
      .select("response_role, reasoning_summary, recommended_next_step, raw_response_text, created_at")
      .eq("diagnostic_id", diagnosticId)
      .in("response_role", ["user", "assistant"])
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("attachments")
      .select("title, description, ai_image_analysis, annotations")
      .eq("diagnostic_id", diagnosticId)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  return {
    id: data.id,
    label: data.equipment_label ?? "Sem etiqueta",
    summary: data.current_summary ?? data.initial_problem_report,
    initialReport: data.initial_problem_report,
    category: category?.name ?? "Não classificado",
    manufacturer: manufacturer?.name ?? "Não identificado",
    model: model?.model_name ?? "Não informado",
    physicalNotes: data.physical_condition_notes ?? "Sem observações físicas.",
    equipmentDetails: buildEquipmentDetailItemsForAssistant(
      (data.equipment_details as Record<string, unknown> | null | undefined) ?? null,
    ),
    symptoms: (data.diagnostic_symptoms ?? []).map((item) => ({
      name: pickRelation(item.symptoms)?.name ?? "Sintoma",
      severity: item.severity,
      isPrimary: item.is_primary,
      group: pickRelation(item.symptoms)?.symptom_group ?? null,
      notes: item.notes ?? null,
    })),
    tests: (data.diagnostic_test_runs ?? []).map((item) => ({
      testId: pickRelation(item.tests)?.id ?? null,
      testName: pickRelation(item.tests)?.name ?? "Teste",
      testGroup: pickRelation(item.tests)?.test_group ?? null,
      resultStatus: item.result_status,
      stepOrder: item.step_order,
      procedureNotes: item.procedure_notes,
      expectedResult: item.expected_result ?? null,
      actualResult: item.actual_result,
      conclusion: item.conclusion ?? null,
    })),
    measurements: (data.measurements ?? []).map((item) => {
      const observation = item.measurement_context ?? item.expected_value_text ?? null;

      return {
        measurementType: item.measurement_type,
        pointLabel: item.point_label,
        measuredValueNumeric: item.measured_value_numeric,
        measuredValueText: item.measured_value_text,
        expectedValueText: item.expected_value_text,
        unit: item.unit,
        context: item.measurement_context ?? null,
        toleranceText: item.tolerance_text ?? null,
        observation,
        inferredTerms: inferMeasurementTerms({
          pointLabel: item.point_label,
          measuredValueText: item.measured_value_text,
          expectedValueText: item.expected_value_text,
          context: item.measurement_context ?? null,
          observation,
        }),
      };
    }),
    hypotheses: (data.hypotheses ?? []).map((item) => ({
      title: item.title,
      description: item.description,
      evidenceSummary: item.evidence_summary,
      confidenceScore: item.confidence_score,
      status: item.status,
    })),
    technicalAssets: Array.from(
      new Map(
        (technicalAssetLinksResult.data ?? [])
          .map((item) => {
            const asset = pickRelation(
              (item as {
                technical_assets:
                  | {
                      id: string;
                      original_filename: string;
                      asset_type: string;
                      file_format: string;
                    }
                  | Array<{
                      id: string;
                      original_filename: string;
                      asset_type: string;
                      file_format: string;
                    }>
                  | null;
              }).technical_assets,
            );

            if (!asset) {
              return null;
            }

            return [
              asset.id,
              {
                id: asset.id,
                title: asset.original_filename,
                assetType: asset.asset_type,
                fileFormat: asset.file_format,
                boardName:
                  pickRelation(
                    (item as {
                      boards:
                        | { board_code: string | null }
                        | Array<{ board_code: string | null }>
                        | null;
                    }).boards,
                  )?.board_code ?? null,
                modelName:
                  pickRelation(
                    (item as {
                      equipment_models:
                        | { model_name: string | null }
                        | Array<{ model_name: string | null }>
                        | null;
                    }).equipment_models,
                  )?.model_name ?? null,
              },
            ] as const;
          })
          .filter(
            (
              item,
            ): item is readonly [
              string,
              DiagnosticAssistantContext["technicalAssets"][number],
            ] => Boolean(item),
          ),
      ).values(),
    ),
    recentAssistantHistory: ((recentResponsesResult.data ?? []) as Array<{
      response_role: "user" | "assistant";
      reasoning_summary: string | null;
      recommended_next_step: string | null;
      raw_response_text: string | null;
      created_at: string;
    }>).map((item) => ({
      role: item.response_role,
      summary:
        item.response_role === "assistant"
          ? item.recommended_next_step ??
            item.reasoning_summary ??
            item.raw_response_text ??
            "Resposta tecnica sem resumo."
          : item.raw_response_text ?? item.reasoning_summary ?? "Pergunta sem texto.",
      createdAt: item.created_at,
    })),
    attachments: ((attachmentsResult.data ?? []) as Array<{
      title: string;
      description: string | null;
      ai_image_analysis:
        | {
            observations?: string[];
            suspectedIssues?: string[];
            recommendation?: string;
          }
        | null;
      annotations: Array<{ note?: string | null }> | null;
    }>).map((item) => {
      const summary = [
        ...(item.ai_image_analysis?.observations ?? []).slice(0, 2),
        ...(item.ai_image_analysis?.suspectedIssues ?? []).slice(0, 2),
        item.ai_image_analysis?.recommendation ?? null,
        ...(item.annotations ?? [])
          .map((annotation) => annotation.note ?? null)
          .filter((note): note is string => Boolean(note))
          .slice(0, 2),
      ]
        .filter((entry): entry is string => Boolean(entry))
        .join(" ");

      return {
        title: item.title,
        description: item.description ?? null,
        summary: summary || item.description || item.title,
      };
    }),
    benchPrompt,
    technicalContextSummary: null,
  };
}

async function getSimilarCasesAndDocuments(
  context: DiagnosticAssistantContext,
  supabase: SupabaseServerClient,
) {
  const query = [
    context.summary,
    context.initialReport,
    context.benchPrompt,
    context.technicalContextSummary,
    ...context.equipmentDetails.slice(0, 4).map((item) => `${item.label} ${item.value}`),
    ...context.symptoms.slice(0, 3).map((item) => item.name),
    ...context.measurements.slice(0, 4).flatMap((item) => [
      item.pointLabel,
      item.measuredValueText,
      item.expectedValueText,
      item.context,
      ...item.inferredTerms,
    ]),
    ...context.hypotheses.slice(0, 2).map((item) => item.title),
    ...context.recentAssistantHistory.slice(0, 3).map((item) => item.summary),
    ...context.attachments.slice(0, 2).map((item) => item.summary),
  ]
    .filter(Boolean)
    .join(" ");

  if (query.trim().length < 3) {
    return {
      similarCases: [] as SemanticMatchResult[],
      relatedDocuments: [] as SemanticMatchResult[],
    };
  }

  const { vector } = await generateTextEmbedding(query);
  const { data } = await supabase.rpc("match_embedding_sources", {
    query_embedding: formatVectorLiteral(vector),
    match_count: 10,
    filter_source_types: ["diagnostic", "resolved_case", "technical_document"],
    filter_content_roles: ["summary", "solution_summary"],
  });

  const matches = (data ?? []) as Array<{
    embedding_source_id: string;
    source_type: "diagnostic" | "resolved_case" | "technical_document";
    source_id: string;
    content_text: string;
    similarity: number;
  }>;

  const caseRows = matches.filter(
    (item) => item.source_type === "diagnostic" || item.source_type === "resolved_case",
  );
  const docRows = matches.filter((item) => item.source_type === "technical_document");

  const resolvedCaseIds = caseRows
    .filter((item) => item.source_type === "resolved_case")
    .map((item) => item.source_id);
  const diagnosticIds = caseRows
    .filter((item) => item.source_type === "diagnostic")
    .map((item) => item.source_id)
    .filter((item) => item !== context.id);
  const documentIds = docRows.map((item) => item.source_id);

  const [resolvedResult, diagnosticsResult, documentsResult] = await Promise.all([
    resolvedCaseIds.length
      ? supabase
          .from("resolved_cases")
          .select("id, diagnostic_id, resolution_summary")
          .in("id", resolvedCaseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; diagnostic_id: string; resolution_summary: string }> }),
    diagnosticIds.length
      ? supabase
          .from("diagnostics")
          .select("id, equipment_label, current_summary, initial_problem_report")
          .in("id", diagnosticIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            equipment_label: string | null;
            current_summary: string | null;
            initial_problem_report: string;
          }>,
        }),
    documentIds.length
      ? supabase
          .from("technical_documents")
          .select("id, title, storage_path")
          .in("id", documentIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; storage_path: string }> }),
  ]);

  const resolvedMap = new Map((resolvedResult.data ?? []).map((item) => [item.id, item]));
  const diagnosticsMap = new Map((diagnosticsResult.data ?? []).map((item) => [item.id, item]));
  const documentsMap = new Map((documentsResult.data ?? []).map((item) => [item.id, item]));
  const candidateDiagnosticIds = [
    ...new Set([
      ...diagnosticIds,
      ...((resolvedResult.data ?? []).map((item) => item.diagnostic_id).filter((item): item is string => Boolean(item))),
    ]),
  ];
  const diagnosticMetadataResult = candidateDiagnosticIds.length
    ? await supabase
        .from("diagnostics")
        .select("id, manufacturers(name), equipment_models(model_name)")
        .in("id", candidateDiagnosticIds)
    : {
        data: [] as Array<{
          id: string;
          manufacturers: { name: string | null } | Array<{ name: string | null }> | null;
          equipment_models: { model_name: string | null } | Array<{ model_name: string | null }> | null;
        }>,
      };
  const diagnosticMetadataMap = new Map(
    (diagnosticMetadataResult.data ?? []).map((item) => [
      item.id,
      {
        manufacturer: pickRelation(item.manufacturers)?.name ?? "",
        model: pickRelation(item.equipment_models)?.model_name ?? "",
      },
    ]),
  );
  const contextManufacturer = normalizeComparable(context.manufacturer);
  const contextModel = normalizeComparable(context.model);

  const matchesCurrentEquipment = (diagnosticId: string | null | undefined) => {
    if (!diagnosticId) {
      return false;
    }

    const metadata = diagnosticMetadataMap.get(diagnosticId);

    if (!metadata) {
      return false;
    }

    const candidateManufacturer = normalizeComparable(metadata.manufacturer);
    const candidateModel = normalizeComparable(metadata.model);

    if (contextManufacturer && candidateManufacturer !== contextManufacturer) {
      return false;
    }

    if (isMeaningfulValue(context.model)) {
      return candidateModel === contextModel;
    }

    return isMeaningfulValue(metadata.manufacturer);
  };

  const similarCases: SemanticMatchResult[] = [];

  for (const item of caseRows) {
    if (item.source_type === "resolved_case") {
      const resolvedCase = resolvedMap.get(item.source_id);

      if (!resolvedCase || !matchesCurrentEquipment(resolvedCase.diagnostic_id)) {
        continue;
      }

      similarCases.push({
        id: item.embedding_source_id,
        sourceType: item.source_type,
        title: "Caso resolvido semelhante",
        subtitle: truncate(resolvedCase.resolution_summary),
        excerpt: truncate(item.content_text),
        similarityLabel: `${Math.round(item.similarity * 100)}%`,
        href: resolvedCase.diagnostic_id ? `/diagnosticos/${resolvedCase.diagnostic_id}` : null,
      });
      continue;
    }

    const diagnostic = diagnosticsMap.get(item.source_id);

    if (!diagnostic || diagnostic.id === context.id || !matchesCurrentEquipment(diagnostic.id)) {
      continue;
    }

    similarCases.push({
      id: item.embedding_source_id,
      sourceType: item.source_type,
      title: diagnostic.equipment_label ?? "Diagnóstico semelhante",
      subtitle: "Contexto operacional da bancada",
      excerpt: truncate(diagnostic.current_summary ?? diagnostic.initial_problem_report),
      similarityLabel: `${Math.round(item.similarity * 100)}%`,
      href: `/diagnosticos/${diagnostic.id}`,
    });
  }

  const relatedDocuments: SemanticMatchResult[] = [];

  for (const item of docRows) {
    const document = documentsMap.get(item.source_id);

    if (!document) {
      continue;
    }

    const signedUrl = (
      await supabase.storage.from("technical-documents").createSignedUrl(document.storage_path, 3600)
    ).data?.signedUrl;

    relatedDocuments.push({
      id: item.embedding_source_id,
      sourceType: item.source_type,
      title: document.title,
      subtitle: "Documento técnico relacionado",
      excerpt: truncate(item.content_text),
      similarityLabel: `${Math.round(item.similarity * 100)}%`,
      href: signedUrl ?? null,
    });
  }

  return {
    similarCases: similarCases.slice(0, 3),
    relatedDocuments: relatedDocuments.slice(0, 3),
  };
}

async function getHistoricalSymptomGroupInsights(supabase: SupabaseServerClient) {
  const { data } = await supabase
    .from("resolved_cases")
    .select(
      `
        final_failure_mode,
        diagnostics(
          diagnostic_symptoms(symptoms(symptom_group))
        )
      `,
    )
    .not("final_failure_mode", "is", null);

  const causeCounts = new Map<string, Map<string, number>>();

  for (const row of
    ((data ?? []) as Array<{
      final_failure_mode: string | null;
      diagnostics:
        | { diagnostic_symptoms: Array<{ symptoms: { symptom_group: string | null } | Array<{ symptom_group: string | null }> | null }> | null }
        | Array<{ diagnostic_symptoms: Array<{ symptoms: { symptom_group: string | null } | Array<{ symptom_group: string | null }> | null }> | null }>
        | null;
    }>)) {
    if (!row.final_failure_mode) {
      continue;
    }

    const diagnostic = pickRelation(row.diagnostics);
    const groups = new Set(
      (diagnostic?.diagnostic_symptoms ?? [])
        .map((item) => pickRelation(item.symptoms)?.symptom_group)
        .filter((item): item is string => Boolean(item)),
    );

    for (const group of groups) {
      const tally = causeCounts.get(group) ?? new Map<string, number>();
      tally.set(row.final_failure_mode, (tally.get(row.final_failure_mode) ?? 0) + 1);
      causeCounts.set(group, tally);
    }
  }

  const insightMap = new Map<string, { topCause: string; count: number }>();

  for (const [group, tally] of causeCounts) {
    const [topCause, count] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    insightMap.set(group, { topCause, count });
  }

  return insightMap;
}

async function getAvailableTests(
  supabase: SupabaseServerClient,
) {
  const { data } = await supabase
    .from("tests")
    .select("id, name, test_group")
    .eq("is_active", true)
    .order("name")
    .limit(20);

  return (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    group: item.test_group,
  }));
}

type BenchTechnicalContext = NonNullable<AssistantStructuredResponse["technicalContext"]>;

export function buildBenchRelatedLines(
  context: DiagnosticAssistantContext,
  technicalContext: BenchTechnicalContext | null,
) {
  const lines: Array<{ name: string; expectedVoltage: string; note: string }> = [];
  const seen = new Set<string>();

  for (const measurement of context.measurements) {
    const candidateName = measurement.pointLabel?.trim();
    if (!candidateName) {
      continue;
    }

    const key = candidateName.toUpperCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push({
      name: candidateName,
      expectedVoltage: measurement.expectedValueText ?? "Nao informado",
      note:
        measurement.measuredValueText ??
        (measurement.measuredValueNumeric !== null
          ? `Medido ${measurement.measuredValueNumeric}${measurement.unit ? ` ${measurement.unit}` : ""}`
          : measurement.context ?? "Linha mencionada no historico de medicao."),
    });
  }

  for (const result of technicalContext?.boardview?.results ?? []) {
    const netName = result.relatedNet ?? (result.kind === "net" ? result.title : null);
    if (!netName) {
      continue;
    }

    const key = netName.toUpperCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    lines.push({
      name: netName,
      expectedVoltage: "Confirmar no esquema e nas medicoes da bancada",
      note: result.details[0] ?? result.subtitle,
    });
  }

  return lines.slice(0, 5);
}

export function buildBenchComponentsToMeasure(
  context: DiagnosticAssistantContext,
  technicalContext: BenchTechnicalContext | null,
) {
  const items: Array<{
    reference: string;
    measurementPoint: string;
    expectedValue: string;
    note: string;
  }> = [];
  const seen = new Set<string>();

  for (const result of technicalContext?.boardview?.results ?? []) {
    const key = `${result.kind}:${result.title}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      reference: result.title,
      measurementPoint: result.coordinateHint ?? result.locationSummary ?? result.subtitle,
      expectedValue:
        result.relatedNet
          ? `Comparar com a net ${result.relatedNet} no esquema e nas medicoes`
          : "Comparar com o comportamento esperado do setor",
      note: result.details.join(" "),
    });
  }

  for (const measurement of context.measurements) {
    const point = measurement.pointLabel?.trim();
    if (!point) {
      continue;
    }

    const key = `measurement:${point.toUpperCase()}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      reference: point,
      measurementPoint: measurement.measurementType,
      expectedValue: measurement.expectedValueText ?? "Nao informado",
      note: measurement.measuredValueText ?? "Ponto ja medido neste diagnostico.",
    });
  }

  return items.slice(0, 6);
}

function buildBenchExpectedVoltages(
  relatedLines: Array<{ name: string; expectedVoltage: string; note: string }>,
) {
  return relatedLines.map((item) => ({
    line: item.name,
    expectedValue: item.expectedVoltage,
    condition: null,
    note: item.note,
  }));
}

function buildBenchTestPoints(
  technicalContext: BenchTechnicalContext | null,
  componentsToMeasure: Array<{
    reference: string;
    measurementPoint: string;
    expectedValue: string;
    note: string;
  }>,
) {
  const points: Array<{
    label: string;
    net: string | null;
    location: string | null;
    expectedValue: string | null;
    note: string;
  }> = (technicalContext?.boardview?.results ?? []).map((result) => ({
    label: result.coordinateHint ?? result.title,
    net: result.relatedNet ?? null,
    location: result.locationSummary ?? null,
    expectedValue: null,
    note: result.subtitle,
  }));

  for (const component of componentsToMeasure) {
    points.push({
      label: component.reference,
      net: null,
      location: component.measurementPoint,
      expectedValue: component.expectedValue,
      note: component.note,
    });
  }

  return Array.from(
    new Map(points.map((item) => [`${item.label}:${item.location ?? ""}`, item] as const)).values(),
  ).slice(0, 6);
}

function buildBenchWhereToOpen(
  technicalContext: BenchTechnicalContext | null,
  similarCases: SemanticMatchResult[],
  relatedDocuments: SemanticMatchResult[],
) {
  const items: NonNullable<AssistantStructuredResponse["whereToOpen"]> = [];

  for (const result of technicalContext?.boardview?.results ?? []) {
    items.push({
      title: result.title,
      targetType: result.kind === "net" ? "boardview_net" : "boardview_component",
      href: result.openLabHref,
      page: null,
      component: result.kind === "component" ? result.title : null,
      net: result.kind === "net" ? result.title : result.relatedNet ?? null,
      note: result.locationSummary ?? result.coordinateHint ?? result.subtitle,
    });
  }

  for (const match of technicalContext?.schematic?.matches ?? []) {
    items.push({
      title: `${match.term} pagina ${match.pageNumber}`,
      targetType: "schematic_page",
      href: match.openLabHref,
      page: match.pageNumber,
      component: null,
      net: match.term,
      note: match.excerpt,
    });
  }

  for (const item of similarCases.slice(0, 2)) {
    items.push({
      title: item.title,
      targetType: "diagnostic",
      href: item.href,
      page: null,
      component: null,
      net: null,
      note: item.similarityLabel,
    });
  }

  for (const item of relatedDocuments.slice(0, 2)) {
    items.push({
      title: item.title,
      targetType: "document",
      href: item.href,
      page: null,
      component: null,
      net: null,
      note: item.similarityLabel,
    });
  }

  return Array.from(
    new Map(items.map((item) => [`${item.targetType}:${item.title}`, item] as const)).values(),
  ).slice(0, 8);
}

async function buildStructuredResponse(
  context: DiagnosticAssistantContext,
  similarCases: SemanticMatchResult[],
  relatedDocuments: SemanticMatchResult[],
  availableTests: Array<{ id: string; name: string; group: string | null }>,
  groupSuccessRate: Map<string, number>,
  symptomGroupInsights: Map<string, { topCause: string; count: number }>,
  technicalContext: BenchTechnicalContext | null = null,
) {
  const strategy = resolveCategoryStrategy(context.category);
  const activeScenario = inferAssistantScenario(context);
  const latestTest = [...context.tests].sort((a, b) => b.stepOrder - a.stepOrder)[0] ?? null;
  const latestMeasurement = context.measurements[0] ?? null;
  const primarySymptomEntry =
    context.symptoms.find((item) => item.isPrimary) ?? context.symptoms[0] ?? null;
  const primarySymptom = primarySymptomEntry?.name ?? null;
  const primarySymptomInsight = primarySymptomEntry?.group
    ? symptomGroupInsights.get(primarySymptomEntry.group) ?? null
    : null;
  const strongestHypothesis = [...context.hypotheses]
    .sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))[0] ?? null;
  const availableBoardviewAsset =
    context.technicalAssets.find(
      (item) => item.fileFormat === "brd" || item.fileFormat === "bdv",
    ) ?? null;
  const availableSchematicAsset =
    context.technicalAssets.find((item) => item.fileFormat === "pdf") ?? null;
  const recommendedTest = pickUnperformedTest(
    availableTests,
    context.tests.map((item) => item.testName),
    context.symptoms.map((item) => item.name),
    strategy.preferredGroups,
    groupSuccessRate,
  );
  const nextTestName = recommendedTest?.name ?? "Executar o próximo teste objetivo da bancada";
  const normalizedBenchPrompt = normalizeComparable(context.benchPrompt);
  const primaryBoardviewFinding = technicalContext?.boardview?.results[0] ?? null;
  const primarySchematicFinding = technicalContext?.schematic?.matches[0] ?? null;

  let nextTest = "Registrar um próximo passo objetivo na bancada.";
  let validationGoal = "Gerar evidência suficiente para reduzir as hipóteses abertas.";
  const latestMeasurementSummary = latestMeasurement
    ? `${latestMeasurement.measurementType} em ${latestMeasurement.pointLabel ?? "ponto não informado"} com leitura ${latestMeasurement.measuredValueText ?? latestMeasurement.measuredValueNumeric ?? "não informada"}${latestMeasurement.unit ? ` ${latestMeasurement.unit}` : ""}`
    : null;
  const mainHypothesis =
    strongestHypothesis?.title ??
    (primarySymptomInsight
      ? `Historicamente, a causa mais recorrente para sintomas do grupo ${primarySymptomEntry?.group} foi ${primarySymptomInsight.topCause} (em ${primarySymptomInsight.count} caso(s) resolvido(s)).`
      : primarySymptom
        ? `A falha principal ainda precisa ser isolada a partir do sintoma ${primarySymptom}.`
        : "Ainda não há hipótese dominante com evidência suficiente.");

  if (!context.symptoms.length) {
    nextTest = "Registrar pelo menos um sintoma principal antes de pedir nova recomendação.";
    validationGoal = "Dar contexto mínimo para que a triagem deixe de ser genérica.";
  } else if (
    normalizedBenchPrompt.includes("esquema") ||
    normalizedBenchPrompt.includes("boardview") ||
    normalizedBenchPrompt.includes("net") ||
    normalizedBenchPrompt.includes("linha")
  ) {
    nextTest = availableSchematicAsset
      ? `Abrir o esquema ${availableSchematicAsset.title} e localizar a linha ou referência citada antes de medir o próximo ponto.`
      : availableBoardviewAsset
        ? `Abrir o boardview ${availableBoardviewAsset.title} e seguir a linha ou componente citado antes de medir o próximo ponto.`
        : "Selecionar um boardview ou esquema associado para localizar a linha citada e definir o próximo ponto de medição.";
    validationGoal =
      "Transformar a pergunta da bancada em um ponto, linha ou componente concreto antes de abrir novas hipóteses.";
  } else if (!context.tests.length) {
    nextTest = `Executar o teste ${nextTestName} e registrar procedimento e resultado observado.`;
    validationGoal = `${activeScenario.summary} ${strategy.firstMove}`;
  } else if (latestTest?.resultStatus === "pending") {
    nextTest = `Concluir o teste ${latestTest.testName} antes de abrir outra frente de verificação.`;
    validationGoal = "Evitar ramificações sem fechar a evidência que já foi iniciada.";
  } else if (!context.measurements.length) {
    nextTest = `Adicionar uma medição objetiva priorizando: ${activeScenario.firstMeasurements[0]}.`;
    validationGoal = `Transformar a conclusão do teste em dado auditável e seguir o protocolo ${activeScenario.title}.`;
  } else if (strongestHypothesis) {
    nextTest = `Validar a hipótese ${strongestHypothesis.title} com um teste binário ou medição no ponto mais próximo da causa suspeita.`;
    validationGoal = "Confirmar ou enfraquecer a hipótese mais forte sem repetir etapas já percorridas.";
  } else if (primaryBoardviewFinding) {
    nextTest = `Medir primeiro em ${primaryBoardviewFinding.title}${primaryBoardviewFinding.relatedNet ? ` na net ${primaryBoardviewFinding.relatedNet}` : ""}, usando ${primaryBoardviewFinding.coordinateHint ?? primaryBoardviewFinding.locationSummary ?? primaryBoardviewFinding.subtitle}.`;
    validationGoal = primarySchematicFinding
      ? `Cruzar a leitura com o esquema na página ${primarySchematicFinding.pageNumber} antes de trocar componente.`
      : "Confirmar no boardview se o ponto sugerido representa a causa ou apenas o sintoma.";
  } else {
    nextTest = latestMeasurementSummary
      ? `Com base na medição registrada (${latestMeasurementSummary}), execute o teste ${nextTestName} para validar ${activeScenario.nextChecks[0].toLowerCase()}.`
      : `Executar o teste ${nextTestName} como próxima separação objetiva do defeito.`;
    validationGoal = `Avançar um passo com maior poder de isolamento seguindo o protocolo ${activeScenario.title}.`;
  }

  const evidence = [
    `Resumo atual do caso: ${context.summary}`,
    context.benchPrompt ? `Pergunta atual da bancada: ${context.benchPrompt}` : null,
    `Cenário ativo de bancada: ${activeScenario.title}.`,
    `Primeiras medições esperadas no cenário: ${activeScenario.firstMeasurements.join("; ")}.`,
    `Estratégia da categoria: ${strategy.summaryFocus}`,
    primarySymptom ? `Sintoma dominante observado: ${primarySymptom}.` : null,
    primarySymptomInsight
      ? `Histórico do grupo ${primarySymptomEntry?.group}: causa mais frequente foi ${primarySymptomInsight.topCause} (${primarySymptomInsight.count} caso(s)).`
      : null,
    latestTest
      ? `Último teste registrado: ${latestTest.testName} com status ${latestTest.resultStatus}.`
      : null,
    latestMeasurement
      ? `Medição recente: ${latestMeasurement.measurementType} em ${latestMeasurement.pointLabel ?? "ponto não informado"} com leitura ${latestMeasurement.measuredValueText ?? latestMeasurement.measuredValueNumeric ?? "não informada"}${latestMeasurement.unit ? ` ${latestMeasurement.unit}` : ""}.`
      : null,
    strongestHypothesis
      ? `Hipótese mais forte no histórico: ${strongestHypothesis.title}.`
      : null,
    similarCases[0]
      ? `Caso semelhante recuperado: ${similarCases[0].title} (${similarCases[0].similarityLabel}).`
      : null,
    relatedDocuments[0]
      ? `Documento relacionado recuperado: ${relatedDocuments[0].title} (${relatedDocuments[0].similarityLabel}).`
      : null,
    context.technicalAssets.length
      ? `Arquivos técnicos disponíveis para consulta: ${context.technicalAssets
          .map((item) => `${item.title} (${item.fileFormat.toUpperCase()})`)
          .join("; ")}.`
      : "Ainda não há boardview, esquema ou arquivo técnico associado a este diagnóstico.",
  ].filter((item): item is string => Boolean(item));

  const technicalSummary = [
    `O diagnóstico ${context.label} está em ${context.category} da ${context.manufacturer}.`,
    `O foco atual permanece em ${context.summary}.`,
    context.benchPrompt ? `Pergunta ativa do técnico: ${context.benchPrompt}.` : null,
    `Cenário ativo identificado: ${activeScenario.title}. ${activeScenario.summary}`,
    strategy.summaryFocus,
    latestTest
      ? `Já existe histórico de teste suficiente para orientar o próximo passo sem reiniciar a triagem.`
      : `Ainda falta um primeiro teste objetivo para sair da fase de coleta inicial.`,
    context.technicalAssets.length
      ? `A bancada tem ${context.technicalAssets.length} arquivo(s) técnico(s) associado(s) disponível(is) para consulta.`
      : `Ainda não existem arquivos técnicos associados diretamente ao caso.`,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" ");

  const safetyNote = /voltage|current|consumption|linha|fonte|primar/i.test(
    nextTest + " " + context.summary,
  )
    ? strategy.safety
    : "Manter o registro do procedimento e evitar trocar componente sem evidência objetiva.";

  const confidence = Math.min(
    0.86,
    0.28 +
      context.symptoms.length * 0.08 +
      context.tests.length * 0.07 +
      context.measurements.length * 0.05 +
      (strongestHypothesis ? 0.08 : 0) +
      (similarCases.length ? 0.1 : 0) +
      (relatedDocuments.length ? 0.08 : 0) +
      (primarySymptomInsight ? 0.05 : 0),
  );

  const heuristicRelatedLines = buildBenchRelatedLines(context, technicalContext);
  const heuristicComponentsToMeasure = buildBenchComponentsToMeasure(context, technicalContext);
  const heuristicExpectedVoltages = buildBenchExpectedVoltages(heuristicRelatedLines);
  const heuristicTestPoints = buildBenchTestPoints(
    technicalContext,
    heuristicComponentsToMeasure,
  );
  const heuristicWhereToOpen = buildBenchWhereToOpen(
    technicalContext,
    similarCases,
    relatedDocuments,
  );
  const heuristicLimitations = [
    !context.measurements.length ? "Ainda faltam medicoes objetivas registradas na bancada." : null,
    !context.tests.length ? "Ainda faltam testes executados para reduzir as hipoteses." : null,
    !context.technicalAssets.length
      ? "Nao ha boardview ou esquema associado diretamente a este caso."
      : null,
  ].filter((item): item is string => Boolean(item));
  const nextQuestionForTechnician =
    !context.measurements.length
      ? activeScenario.firstMeasurements[0]
      : !technicalContext?.boardview?.results.length && !technicalContext?.schematic?.matches.length
        ? "Qual linha, componente ou tensao voce quer isolar agora? Ex.: PPBUS_G3H, PP3V3_G3H ou U7000."
        : null;

  let narrative: Awaited<ReturnType<typeof generateAssistantNarrative>> extends infer T
    ? T extends null
      ? never
      : T
    : never = {
    probableDiagnosis: mainHypothesis,
    probableArea: activeScenario.title,
    probableSection: activeScenario.title,
    technicalSummary,
    mainHypothesis,
    evidence,
    evidenceFound: evidence,
    relatedLines:
      heuristicRelatedLines.length > 0
        ? heuristicRelatedLines
        : [
            {
              name: "Sem linha identificada",
              expectedVoltage: "Solicitar medicao objetiva",
              note: "O historico atual ainda nao aponta uma net especifica.",
            },
          ],
    expectedVoltages:
      heuristicExpectedVoltages.length > 0
        ? heuristicExpectedVoltages
        : [
            {
              line: "Linha ainda nao definida",
              expectedValue: "Solicitar medicao objetiva",
              condition: null,
              note: "Ainda faltam referencias tecnicas para cravar a tensao esperada.",
            },
          ],
    componentsToMeasure:
      heuristicComponentsToMeasure.length > 0
        ? heuristicComponentsToMeasure
        : [
            {
              reference: "Ponto ainda nao definido",
              measurementPoint: "Escolher no esquema ou boardview",
              expectedValue: "Conforme a linha principal do defeito",
              note: "Falta referencia concreta de componente ou pad no historico.",
            },
          ],
    testPoints:
      heuristicTestPoints.length > 0
        ? heuristicTestPoints
        : [
            {
              label: "Selecionar pad ou test point",
              net: null,
              location: null,
              expectedValue: null,
              note: "Use boardview ou esquema para localizar o primeiro ponto de medicao.",
            },
          ],
    recommendedTestSequence: [
      nextTest,
      ...activeScenario.nextChecks.slice(0, 2).map((item) => `Depois disso: ${item}`),
    ],
    whereToOpen:
      heuristicWhereToOpen.length > 0
        ? heuristicWhereToOpen
        : [
            {
              title: "Abrir assets tecnicos do caso",
              targetType: availableSchematicAsset ? "schematic_page" : "diagnostic",
              href: null,
              page: null,
              component: null,
              net: null,
              note: "Ainda nao houve alvo tecnico concreto para abrir focado.",
            },
          ],
    sourcesUsed: [
      ...similarCases.slice(0, 2).map((item) => `Caso semelhante: ${item.title}`),
      ...relatedDocuments.slice(0, 2).map((item) => `Documento tecnico: ${item.title}`),
      ...context.technicalAssets.slice(0, 2).map((item) => `Asset tecnico: ${item.title}`),
    ],
    confidence: formatConfidence(confidence),
    nextTest,
    validationGoal,
    safetyNote,
    limitations:
      heuristicLimitations.length > 0
        ? heuristicLimitations
        : ["Resposta baseada no historico atual da bancada."],
    nextQuestionForTechnician,
  };
  let modelName = "heuristic-v1";

  if (isLlmConfigured()) {
    try {
      const specialistAgent = getSpecialistAgent(context.category, context.manufacturer);
      const llmNarrative = await generateAssistantNarrative(
        {
          equipmentLabel: context.label,
          category: context.category,
          manufacturer: context.manufacturer,
          model: context.model,
          summary: context.summary,
          initialReport: context.initialReport,
          benchPrompt: context.benchPrompt,
          technicalContextSummary: context.technicalContextSummary,
          equipmentDetails: context.equipmentDetails,
          activeScenario,
          categoryStrategyFocus: strategy.summaryFocus,
          categoryFirstMove: strategy.firstMove,
          categorySafety: strategy.safety,
          symptoms: context.symptoms,
          tests: context.tests.map((item) => ({
            testName: item.testName,
            testGroup: item.testGroup,
            resultStatus: item.resultStatus,
            actualResult: item.actualResult,
            expectedResult: item.expectedResult,
            conclusion: item.conclusion,
          })),
          measurements: context.measurements,
          hypotheses: context.hypotheses.map((item) => ({
            title: item.title,
            confidenceScore: item.confidenceScore,
            status: item.status,
          })),
          recommendedTestName: nextTestName,
          heuristicMainHypothesis: mainHypothesis,
          heuristicNextTest: nextTest,
          heuristicValidationGoal: validationGoal,
          similarCases: similarCases.map((item) => ({
            title: item.title,
            excerpt: item.excerpt,
            similarityLabel: item.similarityLabel,
          })),
          relatedDocuments: relatedDocuments.map((item) => ({
            title: item.title,
            excerpt: item.excerpt,
            href: item.href,
            similarityLabel: item.similarityLabel,
          })),
          technicalAssets: context.technicalAssets.map((item) => ({
            title: item.title,
            fileFormat: item.fileFormat,
            boardName: item.boardName,
            modelName: item.modelName,
          })),
          boardviewFindings: (technicalContext?.boardview?.results ?? []).map((item) => ({
            title: item.title,
            subtitle: item.subtitle,
            details: item.details,
            relatedNet: item.relatedNet ?? null,
            locationSummary: item.locationSummary ?? null,
            coordinateHint: item.coordinateHint ?? null,
            openLabHref: item.openLabHref,
          })),
          schematicFindings: (technicalContext?.schematic?.matches ?? []).map((item) => ({
            term: item.term,
            pageNumber: item.pageNumber,
            occurrences: item.occurrences,
            excerpt: item.excerpt,
            openLabHref: item.openLabHref,
          })),
          documentFindings: relatedDocuments.map((item) => ({
            title: item.title,
            excerpt: item.excerpt,
            similarityLabel: item.similarityLabel,
            href: item.href,
          })),
          measurementContext: context.measurements.map((item) => ({
            label: item.pointLabel ?? item.measurementType,
            measuredValue:
              item.measuredValueText ??
              (item.measuredValueNumeric !== null
                ? `${item.measuredValueNumeric}${item.unit ? ` ${item.unit}` : ""}`
                : "Nao informado"),
            expectedValue: item.expectedValueText ?? null,
            note: item.context ?? item.observation ?? null,
          })),
          diagnosticHistory: [
            ...context.tests.slice(0, 4).map((item) => ({
              kind: "teste",
              title: item.testName,
              summary: item.conclusion ?? item.actualResult ?? item.procedureNotes ?? item.resultStatus,
            })),
            ...context.measurements.slice(0, 4).map((item) => ({
              kind: "medicao",
              title: item.pointLabel ?? item.measurementType,
              summary:
                item.measuredValueText ??
                (item.measuredValueNumeric !== null
                  ? `${item.measuredValueNumeric}${item.unit ? ` ${item.unit}` : ""}`
                  : "Sem leitura"),
            })),
          ].slice(0, 8),
          recentAssistantHistory: context.recentAssistantHistory.map((item) => ({
            role: item.role,
            summary: item.summary,
          })),
          attachmentContext: context.attachments,
          symptomGroupInsight:
            primarySymptomInsight && primarySymptomEntry?.group
              ? {
                  group: primarySymptomEntry.group,
                  topCause: primarySymptomInsight.topCause,
                  count: primarySymptomInsight.count,
                }
              : null,
        },
        specialistAgent.systemInstructions,
      );

      if (llmNarrative) {
        narrative = llmNarrative;
        modelName = getAssistantModelName();
      }
    } catch (error) {
      console.error("[assistant] OpenAI narrative failed", {
        diagnosticId: context.id,
        model: getAssistantModelName(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    confidence,
    modelName,
    narrativeProvider: getNarrativeProviderName(modelName),
    fallbackUsed: modelName === "heuristic-v1",
    rawResponseText: [
      `Diagnostico provavel: ${narrative.probableDiagnosis}`,
      `Setor provavel: ${narrative.probableSection ?? narrative.probableArea}`,
      `Resumo técnico: ${narrative.technicalSummary}`,
      `Hipótese principal: ${narrative.mainHypothesis}`,
      `Evidências: ${narrative.evidence.join(" ")}`,
      `Próximo teste recomendado: ${narrative.nextTest}`,
      `O que esse passo valida: ${narrative.validationGoal}`,
      `Observação de segurança: ${narrative.safetyNote}`,
    ].join("\n\n"),
    structured: {
      probableDiagnosis: narrative.probableDiagnosis,
      probableArea: narrative.probableArea,
      probableSection: narrative.probableSection ?? narrative.probableArea,
      technicalSummary: narrative.technicalSummary,
      mainHypothesis: narrative.mainHypothesis,
      evidence: narrative.evidence,
      evidenceFound: narrative.evidenceFound ?? narrative.evidence,
      relatedLines: narrative.relatedLines,
      expectedVoltages:
        narrative.expectedVoltages ?? buildBenchExpectedVoltages(narrative.relatedLines),
      componentsToMeasure: narrative.componentsToMeasure,
      testPoints:
        narrative.testPoints ?? buildBenchTestPoints(technicalContext, narrative.componentsToMeasure),
      recommendedTestSequence: narrative.recommendedTestSequence,
      whereToOpen:
        narrative.whereToOpen ?? buildBenchWhereToOpen(technicalContext, similarCases, relatedDocuments),
      sourcesUsed: narrative.sourcesUsed ?? [],
      confidence: narrative.confidence ?? formatConfidence(confidence),
      nextTest: narrative.nextTest,
      validationGoal: narrative.validationGoal,
      safetyNote: narrative.safetyNote,
      limitations: narrative.limitations,
      nextQuestionForTechnician: narrative.nextQuestionForTechnician ?? null,
      categoryStrategy: strategy.firstMove,
      recommendedTestId: recommendedTest?.id ?? null,
      recommendedTestName: recommendedTest?.name ?? null,
    } satisfies AssistantStructuredResponse,
  };
}

export async function generateDiagnosticAssistantResponse(
  diagnosticId: string,
  benchPrompt: string | null = null,
) {
  const supabase = await createClient();
  const context = await getDiagnosticAssistantContext(diagnosticId, supabase, benchPrompt);

  if (!context) {
    throw new Error("Diagnóstico não encontrado para gerar recomendação.");
  }

  const [{ similarCases, relatedDocuments }, availableTests, groupSuccessRate, symptomGroupInsights] =
    await Promise.all([
      getSimilarCasesAndDocuments(context, supabase),
      getAvailableTests(supabase),
      getHistoricalTestGroupSuccess(supabase),
      getHistoricalSymptomGroupInsights(supabase),
    ]);

  const payload = await buildStructuredResponse(
    context,
    similarCases,
    relatedDocuments,
    availableTests,
    groupSuccessRate,
    symptomGroupInsights,
    null,
  );

  const { error } = await supabase.from("ai_responses").insert({
    diagnostic_id: diagnosticId,
    prompt_context_version: "assistant-v1",
    response_role: "assistant",
    reasoning_summary: payload.structured.technicalSummary,
    recommended_next_step: payload.structured.nextTest,
    confidence_score: payload.confidence,
    raw_response_text: payload.rawResponseText,
    structured_response_json: payload.structured,
    model_name: payload.modelName,
  });

  if (error) {
    throw error;
  }

  return {
    confidence: payload.confidence,
    provider: getEmbeddingProviderName(),
  };
}

export async function generateDiagnosticAssistantBenchResponse(
  diagnosticId: string,
  benchPrompt: string | null = null,
) {
  const supabase = await createClient();
  const context = await getDiagnosticAssistantContext(
    diagnosticId,
    supabase,
    benchPrompt,
  );

  if (!context) {
    throw new Error("Diagnóstico não encontrado para gerar recomendação.");
  }

  const technicalContextClient =
    supabase as unknown as AssistantTechnicalContextSupabaseClient;
  const technicalContext = await searchAssistantTechnicalContext({
    diagnosticId,
    benchPrompt,
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
      assetNames: context.technicalAssets.map((item) => item.title),
    },
    supabase: technicalContextClient,
  });
  const technicalContextSummary =
    summarizeTechnicalContextForAssistant(technicalContext);
  const contextWithTechnicalData: DiagnosticAssistantContext = {
    ...context,
    technicalContextSummary: technicalContextSummary || null,
  };

  if (benchPrompt) {
    const { error: promptError } = await supabase.from("ai_responses").insert({
      diagnostic_id: diagnosticId,
      prompt_context_version: "assistant-bench-user-v1",
      response_role: "user",
      reasoning_summary: benchPrompt,
      raw_response_text: benchPrompt,
      structured_response_json: {
        userPrompt: benchPrompt,
        technicalContext,
      },
      model_name: "technician-input",
    });

    if (promptError) {
      throw promptError;
    }
  }

  const [
    { similarCases, relatedDocuments },
    availableTests,
    groupSuccessRate,
    symptomGroupInsights,
  ] = await Promise.all([
    getSimilarCasesAndDocuments(contextWithTechnicalData, supabase),
    getAvailableTests(supabase),
    getHistoricalTestGroupSuccess(supabase),
    getHistoricalSymptomGroupInsights(supabase),
  ]);

  const payload = await buildStructuredResponse(
    contextWithTechnicalData,
    similarCases,
    relatedDocuments,
    availableTests,
    groupSuccessRate,
    symptomGroupInsights,
    technicalContext,
  );
  const benchRelatedLines = buildBenchRelatedLines(contextWithTechnicalData, technicalContext);
  const benchComponentsToMeasure = buildBenchComponentsToMeasure(
    contextWithTechnicalData,
    technicalContext,
  );
  const benchSources = [
    ...buildTechnicalContextSources(technicalContext),
    ...similarCases.slice(0, 2).map((item) => `Caso semelhante: ${item.title}`),
    ...relatedDocuments.slice(0, 2).map((item) => `Documento tecnico: ${item.title}`),
  ];
  const benchLimitations = Array.from(
    new Set([
      ...(payload.structured.limitations ?? []),
      ...technicalContext.limitations,
    ]),
  ).slice(0, 6);

  const structuredResponse: AssistantStructuredResponse = {
    ...payload.structured,
    evidence: [
      ...payload.structured.evidence,
      ...buildTechnicalContextEvidence(technicalContext),
    ].slice(0, 8),
    evidenceFound: [
      ...(payload.structured.evidenceFound ?? payload.structured.evidence),
      ...buildTechnicalContextEvidence(technicalContext),
    ].slice(0, 8),
    relatedLines:
      benchRelatedLines.length > 0
        ? benchRelatedLines
        : payload.structured.relatedLines,
    expectedVoltages:
      payload.structured.expectedVoltages ??
      buildBenchExpectedVoltages(
        benchRelatedLines.length > 0 ? benchRelatedLines : payload.structured.relatedLines ?? [],
      ),
    componentsToMeasure:
      benchComponentsToMeasure.length > 0
        ? benchComponentsToMeasure
        : payload.structured.componentsToMeasure,
    testPoints:
      payload.structured.testPoints ??
      buildBenchTestPoints(
        technicalContext,
        benchComponentsToMeasure.length > 0
          ? benchComponentsToMeasure
          : payload.structured.componentsToMeasure ?? [],
      ),
    whereToOpen:
      payload.structured.whereToOpen ??
      buildBenchWhereToOpen(technicalContext, similarCases, relatedDocuments),
    sourcesUsed: Array.from(new Set(benchSources)).slice(0, 10),
    assistantMeta: {
      embeddingProvider: getEmbeddingProviderName(),
      narrativeProvider: payload.narrativeProvider,
      narrativeModel: payload.modelName,
      fallbackUsed: payload.fallbackUsed,
    },
    limitations: benchLimitations.length > 0 ? benchLimitations : payload.structured.limitations,
    technicalContext: {
      ...technicalContext,
      similarCases: similarCases.map((item) => ({
        title: item.title,
        excerpt: item.excerpt,
        similarityLabel: item.similarityLabel,
        href: item.href,
      })),
      documentFindings: relatedDocuments.map((item) => ({
        title: item.title,
        excerpt: item.excerpt,
        similarityLabel: item.similarityLabel,
        href: item.href,
      })),
      measurementContext: contextWithTechnicalData.measurements.map((item) => ({
        label: item.pointLabel ?? item.measurementType,
        measuredValue:
          item.measuredValueText ??
          (item.measuredValueNumeric !== null
            ? `${item.measuredValueNumeric}${item.unit ? ` ${item.unit}` : ""}`
            : "Nao informado"),
        expectedValue: item.expectedValueText ?? null,
        note: item.context ?? item.observation ?? null,
      })),
      diagnosticHistory: [
        ...contextWithTechnicalData.recentAssistantHistory.map((item) => ({
          kind: item.role,
          title: item.role === "assistant" ? "IA" : "Tecnico",
          summary: item.summary,
        })),
        ...contextWithTechnicalData.tests.slice(0, 3).map((item) => ({
          kind: "teste",
          title: item.testName,
          summary: item.conclusion ?? item.actualResult ?? item.resultStatus,
        })),
      ].slice(0, 8),
    },
  };
  const rawResponseText = [
    payload.rawResponseText,
    technicalContextSummary
      ? `Contexto técnico consultado: ${technicalContextSummary}`
      : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("\n\n");

  const { error } = await supabase.from("ai_responses").insert({
    diagnostic_id: diagnosticId,
    prompt_context_version: "assistant-v2-technical-context",
    response_role: "assistant",
    reasoning_summary: structuredResponse.technicalSummary,
    recommended_next_step: structuredResponse.nextTest,
    confidence_score: payload.confidence,
    raw_response_text: rawResponseText,
    structured_response_json: structuredResponse,
    model_name: payload.modelName,
  });

  if (error) {
    throw error;
  }

  return {
    confidence: payload.confidence,
    provider: getEmbeddingProviderName(),
    embeddingProvider: getEmbeddingProviderName(),
    narrativeProvider: payload.narrativeProvider,
    fallbackUsed: payload.fallbackUsed,
  };
}

export async function buildStructuredResponseForTest(args: {
  context: DiagnosticAssistantContext;
  similarCases?: SemanticMatchResult[];
  relatedDocuments?: SemanticMatchResult[];
  availableTests?: Array<{ id: string; name: string; group: string | null }>;
  groupSuccessRate?: Map<string, number>;
  symptomGroupInsights?: Map<string, { topCause: string; count: number }>;
  technicalContext?: BenchTechnicalContext | null;
}) {
  return buildStructuredResponse(
    args.context,
    args.similarCases ?? [],
    args.relatedDocuments ?? [],
    args.availableTests ?? [],
    args.groupSuccessRate ?? new Map<string, number>(),
    args.symptomGroupInsights ?? new Map<string, { topCause: string; count: number }>(),
    args.technicalContext ?? null,
  );
}

export async function getDiagnosticAssistantSnapshot(
  diagnosticId: string,
  client?: SupabaseServerClient,
): Promise<AssistantSnapshot> {
  const supabase = client ?? (await createClient());
  const context = await getDiagnosticAssistantContext(diagnosticId, supabase, null);

  if (!context) {
    return {
      latestResponse: null,
      similarCases: [],
      relatedDocuments: [],
      provider: getEmbeddingProviderName(),
      embeddingProvider: getEmbeddingProviderName(),
      narrativeProvider: "Modo local (fallback heuristico)",
      externalProviderConfigured: isExternalEmbeddingConfigured(),
      activeAgent: {
        id: "default",
        name: "Assistente Geral",
        specialty: "Suporte geral a diagnósticos rápidos e organização de etapas de investigação na bancada.",
      },
    };
  }

  const [{ similarCases, relatedDocuments }, latestResponseResult] = await Promise.all([
    getSimilarCasesAndDocuments(context, supabase),
    supabase
      .from("ai_responses")
      .select(
        `
          id,
          reasoning_summary,
          recommended_next_step,
          confidence_score,
          raw_response_text,
          model_name,
          structured_response_json,
          created_at,
          ai_response_feedback(
            id,
            feedback_rating,
            was_followed,
            note,
            created_at,
            users(full_name)
          )
        `,
      )
      .eq("diagnostic_id", diagnosticId)
      .eq("response_role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestResponse = latestResponseResult.data;
  const activeAgent = getSpecialistAgent(context.category, context.manufacturer);

  return {
    latestResponse: latestResponse
      ? {
          id: latestResponse.id,
          reasoningSummary: latestResponse.reasoning_summary ?? "Sem resumo técnico.",
          recommendedNextStep:
            latestResponse.recommended_next_step ?? "Sem próximo passo registrado.",
          confidenceScore: formatConfidence(Number(latestResponse.confidence_score ?? 0)),
          rawResponseText: latestResponse.raw_response_text,
          modelName: latestResponse.model_name ?? "assistant-v1",
          embeddingProvider:
            latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json === "object" &&
            "assistantMeta" in latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json.assistantMeta === "object" &&
            latestResponse.structured_response_json.assistantMeta &&
            "embeddingProvider" in latestResponse.structured_response_json.assistantMeta
              ? String(latestResponse.structured_response_json.assistantMeta.embeddingProvider)
              : getEmbeddingProviderName(),
          narrativeProvider:
            latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json === "object" &&
            "assistantMeta" in latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json.assistantMeta === "object" &&
            latestResponse.structured_response_json.assistantMeta &&
            "narrativeProvider" in latestResponse.structured_response_json.assistantMeta
              ? String(latestResponse.structured_response_json.assistantMeta.narrativeProvider)
              : getNarrativeProviderName(latestResponse.model_name ?? "heuristic-v1"),
          fallbackUsed:
            latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json === "object" &&
            "assistantMeta" in latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json.assistantMeta === "object" &&
            latestResponse.structured_response_json.assistantMeta &&
            "fallbackUsed" in latestResponse.structured_response_json.assistantMeta
              ? Boolean(latestResponse.structured_response_json.assistantMeta.fallbackUsed)
              : (latestResponse.model_name ?? "heuristic-v1") === "heuristic-v1",
          createdAt: formatRelativeTime(latestResponse.created_at),
          structured:
            latestResponse.structured_response_json &&
            typeof latestResponse.structured_response_json === "object"
              ? (latestResponse.structured_response_json as AssistantStructuredResponse)
              : null,
          feedback: (() => {
            const feedbackRow = Array.isArray(latestResponse.ai_response_feedback)
              ? latestResponse.ai_response_feedback[0]
              : latestResponse.ai_response_feedback;
            const feedbackUser = feedbackRow ? pickRelation(feedbackRow.users) : null;

            if (!feedbackRow) {
              return null;
            }

            return {
              id: feedbackRow.id,
              rating: formatFeedbackRating(feedbackRow.feedback_rating as AiFeedbackRating),
              wasFollowed: feedbackRow.was_followed ?? null,
              note: feedbackRow.note ?? "",
              submittedBy: feedbackUser?.full_name ?? "Técnico interno",
              createdAt: formatRelativeTime(feedbackRow.created_at),
            };
          })(),
        }
      : null,
    similarCases,
    relatedDocuments,
    provider: getEmbeddingProviderName(),
    embeddingProvider: getEmbeddingProviderName(),
    narrativeProvider:
      latestResponse?.model_name
        ? getNarrativeProviderName(latestResponse.model_name)
        : "Modo local (fallback heuristico)",
    externalProviderConfigured: isExternalEmbeddingConfigured(),
    activeAgent: {
      id: activeAgent.id,
      name: activeAgent.name,
      specialty: activeAgent.specialty,
    },
  };
}
