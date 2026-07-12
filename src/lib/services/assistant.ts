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
import { formatRelativeTime } from "@/lib/utils";
import type {
  AiFeedbackRating,
  AssistantStructuredResponse,
  DiagnosticDetail,
  SemanticMatchResult,
} from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type AssistantSnapshot = DiagnosticDetail["assistantSnapshot"];

type DiagnosticAssistantContext = {
  id: string;
  label: string;
  summary: string;
  initialReport: string;
  category: string;
  manufacturer: string;
  physicalNotes: string;
  symptoms: Array<{
    name: string;
    severity: string | null;
    isPrimary: boolean;
    group: string | null;
  }>;
  tests: Array<{
    testId: string | null;
    testName: string;
    testGroup: string | null;
    resultStatus: string;
    stepOrder: number;
    procedureNotes: string | null;
    actualResult: string | null;
  }>;
  measurements: Array<{
    measurementType: string;
    pointLabel: string | null;
    measuredValueNumeric: number | null;
    measuredValueText: string | null;
    expectedValueText: string | null;
    unit: string | null;
  }>;
  hypotheses: Array<{
    title: string;
    description: string | null;
    evidenceSummary: string | null;
    confidenceScore: number | null;
    status: string;
  }>;
};

type CategoryStrategy = {
  preferredGroups: string[];
  summaryFocus: string;
  firstMove: string;
  safety: string;
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

function resolveCategoryStrategy(category: string): CategoryStrategy {
  const normalized = category.toLowerCase();

  if (normalized.includes("notebook")) {
    return {
      preferredGroups: ["power", "electrical", "firmware"],
      summaryFocus:
        "Para notebook, a recomendacao deve separar cedo alimentacao primaria, sequencia de start e corrupcao de firmware antes de trocas amplas.",
      firstMove:
        "Priorizar consumo em fonte assimetrica, tensoes primarias e confirmacao de etapas de start.",
      safety:
        "Remover bateria quando aplicavel e registrar consumo inicial antes de insistir no power.",
    };
  }

  if (normalized.includes("television")) {
    return {
      preferredGroups: ["power", "electrical", "replacement"],
      summaryFocus:
        "Para televisao, a recomendacao deve isolar fonte, backlight, T-Con e trilha de video com foco em blocos funcionais.",
      firstMove:
        "Separar cedo se a falha esta em energia, painel ou processamento de imagem.",
      safety:
        "Cuidado com alta tensao em fonte e backlight antes de medir linhas ativas.",
    };
  }

  if (normalized.includes("smartphone")) {
    return {
      preferredGroups: ["power", "electrical", "replacement"],
      summaryFocus:
        "Para smartphone, a recomendacao deve usar consumo, linha de carga e aquecimento como trilhas principais antes de medidas invasivas.",
      firstMove:
        "Priorizar linha VBAT, linha de carga e observacao termica localizada.",
      safety:
        "Evitar energizar sem controlar corrente e temperatura durante testes de bancada.",
    };
  }

  return {
    preferredGroups: ["power", "electrical", "replacement"],
    summaryFocus:
      "Para desktop, a recomendacao deve separar fonte, acionamento e video antes de substituir subconjuntos inteiros.",
    firstMove:
      "Confirmar energizacao, sinais basicos de start e bloco de video com uma etapa objetiva por vez.",
    safety:
      "Registrar terra e linhas principais antes de medicao em placas energizadas.",
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
        equipment_categories(name),
        manufacturers(name),
        diagnostic_symptoms(severity, is_primary, symptoms(name, symptom_group)),
        diagnostic_test_runs(step_order, result_status, procedure_notes, actual_result, tests(id, name, test_group)),
        measurements(measurement_type, point_label, measured_value_numeric, measured_value_text, expected_value_text, unit),
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

  return {
    id: data.id,
    label: data.equipment_label ?? "Sem etiqueta",
    summary: data.current_summary ?? data.initial_problem_report,
    initialReport: data.initial_problem_report,
    category: category?.name ?? "Nao classificado",
    manufacturer: manufacturer?.name ?? "Nao identificado",
    physicalNotes: data.physical_condition_notes ?? "Sem observacoes fisicas.",
    symptoms: (data.diagnostic_symptoms ?? []).map((item) => ({
      name: pickRelation(item.symptoms)?.name ?? "Sintoma",
      severity: item.severity,
      isPrimary: item.is_primary,
      group: pickRelation(item.symptoms)?.symptom_group ?? null,
    })),
    tests: (data.diagnostic_test_runs ?? []).map((item) => ({
      testId: pickRelation(item.tests)?.id ?? null,
      testName: pickRelation(item.tests)?.name ?? "Teste",
      testGroup: pickRelation(item.tests)?.test_group ?? null,
      resultStatus: item.result_status,
      stepOrder: item.step_order,
      procedureNotes: item.procedure_notes,
      actualResult: item.actual_result,
    })),
    measurements: (data.measurements ?? []).map((item) => ({
      measurementType: item.measurement_type,
      pointLabel: item.point_label,
      measuredValueNumeric: item.measured_value_numeric,
      measuredValueText: item.measured_value_text,
      expectedValueText: item.expected_value_text,
      unit: item.unit,
    })),
    hypotheses: (data.hypotheses ?? []).map((item) => ({
      title: item.title,
      description: item.description,
      evidenceSummary: item.evidence_summary,
      confidenceScore: item.confidence_score,
      status: item.status,
    })),
  };
}

async function getSimilarCasesAndDocuments(
  context: DiagnosticAssistantContext,
  supabase: SupabaseServerClient,
) {
  const query = [
    context.summary,
    ...context.symptoms.slice(0, 3).map((item) => item.name),
    ...context.hypotheses.slice(0, 2).map((item) => item.title),
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

  const similarCases: SemanticMatchResult[] = [];

  for (const item of caseRows) {
    if (item.source_type === "resolved_case") {
      const resolvedCase = resolvedMap.get(item.source_id);

      if (!resolvedCase) {
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

    if (!diagnostic || diagnostic.id === context.id) {
      continue;
    }

    similarCases.push({
      id: item.embedding_source_id,
      sourceType: item.source_type,
      title: diagnostic.equipment_label ?? "Diagnostico semelhante",
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
      subtitle: "Documento tecnico relacionado",
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

async function buildStructuredResponse(
  context: DiagnosticAssistantContext,
  similarCases: SemanticMatchResult[],
  relatedDocuments: SemanticMatchResult[],
  availableTests: Array<{ id: string; name: string; group: string | null }>,
  groupSuccessRate: Map<string, number>,
  symptomGroupInsights: Map<string, { topCause: string; count: number }>,
) {
  const strategy = resolveCategoryStrategy(context.category);
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
  const recommendedTest = pickUnperformedTest(
    availableTests,
    context.tests.map((item) => item.testName),
    context.symptoms.map((item) => item.name),
    strategy.preferredGroups,
    groupSuccessRate,
  );
  const nextTestName = recommendedTest?.name ?? "Executar o proximo teste objetivo da bancada";

  let nextTest = "Registrar um proximo passo objetivo na bancada.";
  let validationGoal = "Gerar evidencia suficiente para reduzir as hipoteses abertas.";
  const mainHypothesis =
    strongestHypothesis?.title ??
    (primarySymptomInsight
      ? `Historicamente, a causa mais recorrente para sintomas do grupo ${primarySymptomEntry?.group} foi ${primarySymptomInsight.topCause} (em ${primarySymptomInsight.count} caso(s) resolvido(s)).`
      : primarySymptom
        ? `A falha principal ainda precisa ser isolada a partir do sintoma ${primarySymptom}.`
        : "Ainda nao ha hipotese dominante com evidencia suficiente.");

  if (!context.symptoms.length) {
    nextTest = "Registrar pelo menos um sintoma principal antes de pedir nova recomendacao.";
    validationGoal = "Dar contexto minimo para que a triagem deixe de ser generica.";
  } else if (!context.tests.length) {
    nextTest = `Executar o teste ${nextTestName} e registrar procedimento e resultado observado.`;
    validationGoal = `${strategy.firstMove} Isso cria a primeira quebra objetiva entre blocos do defeito.`;
  } else if (latestTest?.resultStatus === "pending") {
    nextTest = `Concluir o teste ${latestTest.testName} antes de abrir outra frente de verificacao.`;
    validationGoal = "Evitar ramificacoes sem fechar a evidencia que ja foi iniciada.";
  } else if (!context.measurements.length) {
    nextTest = "Adicionar uma medicao objetiva no ponto principal relacionado ao ultimo teste executado.";
    validationGoal = "Transformar a conclusao do teste em dado comparavel e auditavel.";
  } else if (strongestHypothesis) {
    nextTest = `Validar a hipotese ${strongestHypothesis.title} com um teste binario ou medicao no ponto mais proximo da causa suspeita.`;
    validationGoal = "Confirmar ou enfraquecer a hipotese mais forte sem repetir etapas ja percorridas.";
  } else {
    nextTest = `Executar o teste ${nextTestName} como proxima separacao objetiva do defeito.`;
    validationGoal = "Avancar um passo com maior poder de isolamento do que repetir inspecoes abertas.";
  }

  const evidence = [
    `Resumo atual do caso: ${context.summary}`,
    `Estrategia da categoria: ${strategy.summaryFocus}`,
    primarySymptom ? `Sintoma dominante observado: ${primarySymptom}.` : null,
    primarySymptomInsight
      ? `Historico do grupo ${primarySymptomEntry?.group}: causa mais frequente foi ${primarySymptomInsight.topCause} (${primarySymptomInsight.count} caso(s)).`
      : null,
    latestTest
      ? `Ultimo teste registrado: ${latestTest.testName} com status ${latestTest.resultStatus}.`
      : null,
    latestMeasurement
      ? `Medicao recente: ${latestMeasurement.measurementType} em ${latestMeasurement.pointLabel ?? "ponto nao informado"} com leitura ${latestMeasurement.measuredValueText ?? latestMeasurement.measuredValueNumeric ?? "nao informada"}${latestMeasurement.unit ? ` ${latestMeasurement.unit}` : ""}.`
      : null,
    strongestHypothesis
      ? `Hipotese mais forte no historico: ${strongestHypothesis.title}.`
      : null,
    similarCases[0]
      ? `Caso semelhante recuperado: ${similarCases[0].title} (${similarCases[0].similarityLabel}).`
      : null,
    relatedDocuments[0]
      ? `Documento relacionado recuperado: ${relatedDocuments[0].title} (${relatedDocuments[0].similarityLabel}).`
      : null,
  ].filter((item): item is string => Boolean(item));

  const technicalSummary = [
    `O diagnostico ${context.label} esta em ${context.category} da ${context.manufacturer}.`,
    `O foco atual permanece em ${context.summary}.`,
    strategy.summaryFocus,
    latestTest
      ? `Ja existe historico de teste suficiente para orientar o proximo passo sem reiniciar a triagem.`
      : `Ainda falta um primeiro teste objetivo para sair da fase de coleta inicial.`,
  ].join(" ");

  const safetyNote = /voltage|current|consumption|linha|fonte|primar/i.test(
    nextTest + " " + context.summary,
  )
    ? strategy.safety
    : "Manter o registro do procedimento e evitar trocar componente sem evidencia objetiva.";

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

  let narrative = { technicalSummary, mainHypothesis, evidence, nextTest, validationGoal, safetyNote };
  let modelName = "heuristic-v1";

  if (isLlmConfigured()) {
    try {
      const llmNarrative = await generateAssistantNarrative({
        equipmentLabel: context.label,
        category: context.category,
        manufacturer: context.manufacturer,
        summary: context.summary,
        categoryStrategyFocus: strategy.summaryFocus,
        categoryFirstMove: strategy.firstMove,
        categorySafety: strategy.safety,
        symptoms: context.symptoms,
        tests: context.tests.map((item) => ({
          testName: item.testName,
          testGroup: item.testGroup,
          resultStatus: item.resultStatus,
          actualResult: item.actualResult,
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
        })),
        symptomGroupInsight:
          primarySymptomInsight && primarySymptomEntry?.group
            ? {
                group: primarySymptomEntry.group,
                topCause: primarySymptomInsight.topCause,
                count: primarySymptomInsight.count,
              }
            : null,
      });

      if (llmNarrative) {
        narrative = llmNarrative;
        modelName = getAssistantModelName();
      }
    } catch {
      // Keep the heuristic narrative if the LLM call fails for any reason.
    }
  }

  return {
    confidence,
    modelName,
    rawResponseText: [
      `Resumo tecnico: ${narrative.technicalSummary}`,
      `Hipotese principal: ${narrative.mainHypothesis}`,
      `Evidencias: ${narrative.evidence.join(" ")}`,
      `Proximo teste recomendado: ${narrative.nextTest}`,
      `O que esse passo valida: ${narrative.validationGoal}`,
      `Observacao de seguranca: ${narrative.safetyNote}`,
    ].join("\n\n"),
    structured: {
      technicalSummary: narrative.technicalSummary,
      mainHypothesis: narrative.mainHypothesis,
      evidence: narrative.evidence,
      nextTest: narrative.nextTest,
      validationGoal: narrative.validationGoal,
      safetyNote: narrative.safetyNote,
      categoryStrategy: strategy.firstMove,
      recommendedTestId: recommendedTest?.id ?? null,
      recommendedTestName: recommendedTest?.name ?? null,
    } satisfies AssistantStructuredResponse,
  };
}

export async function generateDiagnosticAssistantResponse(diagnosticId: string) {
  const supabase = await createClient();
  const context = await getDiagnosticAssistantContext(diagnosticId, supabase);

  if (!context) {
    throw new Error("Diagnostico nao encontrado para gerar recomendacao.");
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

export async function getDiagnosticAssistantSnapshot(
  diagnosticId: string,
  client?: SupabaseServerClient,
): Promise<AssistantSnapshot> {
  const supabase = client ?? (await createClient());
  const context = await getDiagnosticAssistantContext(diagnosticId, supabase);

  if (!context) {
    return {
      latestResponse: null,
      similarCases: [],
      relatedDocuments: [],
      provider: getEmbeddingProviderName(),
      externalProviderConfigured: isExternalEmbeddingConfigured(),
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
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const latestResponse = latestResponseResult.data;

  return {
    latestResponse: latestResponse
      ? {
          id: latestResponse.id,
          reasoningSummary: latestResponse.reasoning_summary ?? "Sem resumo tecnico.",
          recommendedNextStep:
            latestResponse.recommended_next_step ?? "Sem proximo passo registrado.",
          confidenceScore: formatConfidence(Number(latestResponse.confidence_score ?? 0)),
          rawResponseText: latestResponse.raw_response_text,
          modelName: latestResponse.model_name ?? "assistant-v1",
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
              submittedBy: feedbackUser?.full_name ?? "Tecnico interno",
              createdAt: formatRelativeTime(feedbackRow.created_at),
            };
          })(),
        }
      : null,
    similarCases,
    relatedDocuments,
    provider: getEmbeddingProviderName(),
    externalProviderConfigured: isExternalEmbeddingConfigured(),
  };
}
