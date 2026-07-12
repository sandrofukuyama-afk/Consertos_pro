import { createHash } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import {
  formatVectorLiteral,
  generateTextEmbedding,
  getEmbeddingProviderName,
  isExternalEmbeddingConfigured,
} from "@/lib/ai/embeddings";
import {
  buildTechnicalDocumentIndexPayload,
  extractTechnicalDocumentText,
} from "@/lib/services/document-indexing";
import { formatRelativeTime } from "@/lib/utils";
import type {
  KnowledgeOverviewData,
  SemanticMatchResult,
} from "@/types/domain";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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

function hashContent(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function resolveClient(client?: SupabaseServerClient) {
  return client ?? createClient();
}

async function findEmbeddingSource(
  supabase: SupabaseServerClient,
  sourceType: string,
  sourceId: string,
  contentRole: string,
) {
  const { data } = await supabase
    .from("embedding_sources")
    .select("id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("content_role", contentRole)
    .maybeSingle();

  return data;
}

async function writeEmbeddingForSource(
  supabase: SupabaseServerClient,
  embeddingSourceId: string,
  contentText: string,
) {
  const { vector, model } = await generateTextEmbedding(contentText);

  await supabase.from("embeddings").delete().eq("embedding_source_id", embeddingSourceId);

  const { error } = await supabase.from("embeddings").insert({
    embedding_source_id: embeddingSourceId,
    model_name: model,
    vector_dimensions: vector.length,
    vector_value: formatVectorLiteral(vector),
  });

  if (error) {
    throw error;
  }

  return model;
}

async function upsertEmbeddingSource(
  supabase: SupabaseServerClient,
  input: {
    sourceType: "diagnostic" | "resolved_case" | "technical_document";
    sourceId: string;
    contentRole: "summary" | "solution_summary";
    contentText: string;
  },
) {
  const existing = await findEmbeddingSource(
    supabase,
    input.sourceType,
    input.sourceId,
    input.contentRole,
  );

  const sourcePayload = {
    source_type: input.sourceType,
    source_id: input.sourceId,
    content_role: input.contentRole,
    content_text: input.contentText,
    content_hash: hashContent(input.contentText),
    language: "pt-BR",
    is_active: true,
    last_generated_at: new Date().toISOString(),
  };

  let embeddingSourceId = existing?.id ?? null;

  if (embeddingSourceId) {
    const { error } = await supabase
      .from("embedding_sources")
      .update(sourcePayload)
      .eq("id", embeddingSourceId);

    if (error) {
      throw error;
    }
  } else {
    const { data, error } = await supabase
      .from("embedding_sources")
      .insert(sourcePayload)
      .select("id")
      .single();

    if (error || !data) {
      throw error ?? new Error("Nao foi possivel inserir a fonte semantica.");
    }

    embeddingSourceId = data.id;
  }

  return writeEmbeddingForSource(supabase, embeddingSourceId, input.contentText);
}

export async function syncDiagnosticEmbeddingSource(
  diagnosticId: string,
  client?: SupabaseServerClient,
) {
  const supabase = await resolveClient(client);
  const { data } = await supabase
    .from("diagnostics")
    .select(
      `
        id,
        status,
        priority,
        equipment_label,
        current_summary,
        initial_problem_report,
        physical_condition_notes,
        equipment_categories(name),
        manufacturers(name)
      `,
    )
    .eq("id", diagnosticId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const category = pickRelation(data.equipment_categories);
  const manufacturer = pickRelation(data.manufacturers);
  const contentText = [
    `Diagnostico ${data.equipment_label ?? data.id}.`,
    `Categoria ${category?.name ?? "Nao classificada"}.`,
    `Fabricante ${manufacturer?.name ?? "Nao identificado"}.`,
    `Status ${data.status}.`,
    `Prioridade ${data.priority}.`,
    `Resumo ${data.current_summary ?? data.initial_problem_report}.`,
    data.physical_condition_notes
      ? `Observacoes fisicas ${data.physical_condition_notes}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return upsertEmbeddingSource(supabase, {
    sourceType: "diagnostic",
    sourceId: data.id,
    contentRole: "summary",
    contentText,
  });
}

export async function syncResolvedCaseEmbeddingSource(
  diagnosticId: string,
  client?: SupabaseServerClient,
) {
  const supabase = await resolveClient(client);
  const { data } = await supabase
    .from("resolved_cases")
    .select(
      `
        id,
        case_status,
        resolution_summary,
        repair_outcome,
        final_failure_mode,
        diagnostics(
          id,
          equipment_label,
          equipment_categories(name),
          manufacturers(name)
        ),
        confirmed_causes(title, technical_explanation),
        applied_solutions(title, procedure_description)
      `,
    )
    .eq("diagnostic_id", diagnosticId)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const diagnostic = pickRelation(data.diagnostics);
  const category = pickRelation(diagnostic?.equipment_categories);
  const manufacturer = pickRelation(diagnostic?.manufacturers);
  const cause = Array.isArray(data.confirmed_causes) ? data.confirmed_causes[0] : null;
  const solution = Array.isArray(data.applied_solutions) ? data.applied_solutions[0] : null;
  const contentText = [
    `Caso resolvido ${diagnostic?.equipment_label ?? diagnostic?.id ?? data.id}.`,
    `Categoria ${category?.name ?? "Nao classificada"}.`,
    `Fabricante ${manufacturer?.name ?? "Nao identificado"}.`,
    `Classificacao ${data.case_status}.`,
    `Falha final ${data.final_failure_mode ?? "Nao detalhada"}.`,
    `Resolucao ${data.resolution_summary}.`,
    `Resultado ${data.repair_outcome}.`,
    cause?.title ? `Causa confirmada ${cause.title}.` : "",
    cause?.technical_explanation
      ? `Explicacao tecnica ${cause.technical_explanation}.`
      : "",
    solution?.title ? `Solucao aplicada ${solution.title}.` : "",
    solution?.procedure_description
      ? `Procedimento ${solution.procedure_description}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return upsertEmbeddingSource(supabase, {
    sourceType: "resolved_case",
    sourceId: data.id,
    contentRole: "solution_summary",
    contentText,
  });
}

export async function syncTechnicalDocumentSemanticSource(
  documentId: string,
  file?: File,
  client?: SupabaseServerClient,
) {
  const supabase = await resolveClient(client);
  const { data } = await supabase
    .from("technical_documents")
    .select(
      `
        id,
        title,
        document_type,
        storage_path,
        mime_type,
        notes,
        manufacturers(name)
      `,
    )
    .eq("id", documentId)
    .maybeSingle();

  if (!data) {
    return {
      indexed: false,
      chunksCount: 0,
      model: getEmbeddingProviderName(),
    };
  }

  const manufacturer = pickRelation(data.manufacturers);
  const extractedText = file ? await extractTechnicalDocumentText(file) : "";
  const payload = buildTechnicalDocumentIndexPayload({
    title: data.title,
    documentType: data.document_type,
    manufacturerName: manufacturer?.name ?? null,
    notes: data.notes,
    fileName: data.storage_path,
    mimeType: data.mime_type,
    extractedText,
  });

  await supabase.from("document_chunks").delete().eq("technical_document_id", data.id);

  if (payload.chunks.length) {
    const { error: chunkError } = await supabase.from("document_chunks").insert(
      payload.chunks.map((chunk) => ({
        technical_document_id: data.id,
        chunk_order: chunk.chunkOrder,
        section_label: chunk.sectionLabel,
        chunk_text: chunk.chunkText,
        token_estimate: chunk.tokenEstimate,
      })),
    );

    if (chunkError) {
      throw chunkError;
    }
  }

  const model = await upsertEmbeddingSource(supabase, {
    sourceType: "technical_document",
    sourceId: data.id,
    contentRole: "summary",
    contentText: payload.summaryText,
  });

  await supabase
    .from("technical_documents")
    .update({ is_indexed: payload.chunks.length > 0 })
    .eq("id", data.id);

  return {
    indexed: payload.chunks.length > 0,
    chunksCount: payload.chunks.length,
    model,
  };
}

export async function syncSemanticBacklog(
  limit = 40,
  client?: SupabaseServerClient,
) {
  const supabase = await resolveClient(client);
  const [documentsResult, diagnosticsResult, resolvedResult] = await Promise.all([
    supabase
      .from("technical_documents")
      .select("id")
      .eq("is_indexed", false)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("diagnostics")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(limit),
    supabase
      .from("resolved_cases")
      .select("diagnostic_id")
      .order("updated_at", { ascending: false })
      .limit(limit),
  ]);

  let processed = 0;

  for (const row of documentsResult.data ?? []) {
    await syncTechnicalDocumentSemanticSource(row.id, undefined, supabase);
    processed += 1;
  }

  for (const row of diagnosticsResult.data ?? []) {
    await syncDiagnosticEmbeddingSource(row.id, supabase);
    processed += 1;
  }

  for (const row of resolvedResult.data ?? []) {
    await syncResolvedCaseEmbeddingSource(row.diagnostic_id, supabase);
    processed += 1;
  }

  return {
    processed,
    provider: getEmbeddingProviderName(),
  };
}

export async function getSemanticSearchResults(
  query: string,
  client?: SupabaseServerClient,
) {
  const supabase = await resolveClient(client);
  const trimmed = query.trim();

  if (trimmed.length < 3) {
    return {
      matches: [] as SemanticMatchResult[],
      provider: getEmbeddingProviderName(),
      externalProviderConfigured: isExternalEmbeddingConfigured(),
    };
  }

  const { vector } = await generateTextEmbedding(trimmed);
  const { data } = await supabase.rpc("match_embedding_sources", {
    query_embedding: formatVectorLiteral(vector),
    match_count: 6,
    filter_source_types: ["diagnostic", "resolved_case", "technical_document"],
    filter_content_roles: ["summary", "solution_summary"],
  });

  const rawMatches = (data ?? []) as Array<{
    embedding_source_id: string;
    source_type: "diagnostic" | "resolved_case" | "technical_document";
    source_id: string;
    content_text: string;
    similarity: number;
  }>;

  const resolvedCaseIds = rawMatches
    .filter((item) => item.source_type === "resolved_case")
    .map((item) => item.source_id);
  const technicalDocumentIds = rawMatches
    .filter((item) => item.source_type === "technical_document")
    .map((item) => item.source_id);

  const [resolvedCasesResult, documentsResult] = await Promise.all([
    resolvedCaseIds.length
      ? supabase
          .from("resolved_cases")
          .select("id, diagnostic_id, resolution_summary")
          .in("id", resolvedCaseIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            diagnostic_id: string;
            resolution_summary: string;
          }>,
        }),
    technicalDocumentIds.length
      ? supabase
          .from("technical_documents")
          .select("id, title, storage_path")
          .in("id", technicalDocumentIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            title: string;
            storage_path: string;
          }>,
        }),
  ]);

  const resolvedCaseMap = new Map(
    (resolvedCasesResult.data ?? []).map((item) => [item.id, item]),
  );
  const documentsMap = new Map(
    (documentsResult.data ?? []).map((item) => [item.id, item]),
  );

  const matches = await Promise.all(
    rawMatches.map(async (item) => {
      if (item.source_type === "technical_document") {
        const document = documentsMap.get(item.source_id);
        const signedUrl = document
          ? (
              await supabase.storage
                .from("technical-documents")
                .createSignedUrl(document.storage_path, 3600)
            ).data?.signedUrl ?? null
          : null;

        return {
          id: item.embedding_source_id,
          sourceType: item.source_type,
          title: document?.title ?? "Documento tecnico",
          subtitle: "Documento tecnico indexado",
          excerpt: truncate(item.content_text),
          similarityLabel: `${Math.round(item.similarity * 100)}%`,
          href: signedUrl,
        } satisfies SemanticMatchResult;
      }

      if (item.source_type === "resolved_case") {
        const resolvedCase = resolvedCaseMap.get(item.source_id);

        return {
          id: item.embedding_source_id,
          sourceType: item.source_type,
          title: "Caso resolvido semelhante",
          subtitle: truncate(resolvedCase?.resolution_summary ?? "Memoria consolidada"),
          excerpt: truncate(item.content_text),
          similarityLabel: `${Math.round(item.similarity * 100)}%`,
          href: resolvedCase?.diagnostic_id
            ? `/diagnosticos/${resolvedCase.diagnostic_id}`
            : null,
        } satisfies SemanticMatchResult;
      }

      return {
        id: item.embedding_source_id,
        sourceType: item.source_type,
        title: "Diagnostico semelhante",
        subtitle: "Contexto operacional da bancada",
        excerpt: truncate(item.content_text),
        similarityLabel: `${Math.round(item.similarity * 100)}%`,
        href: `/diagnosticos/${item.source_id}`,
      } satisfies SemanticMatchResult;
    }),
  );

  return {
    matches,
    provider: getEmbeddingProviderName(),
    externalProviderConfigured: isExternalEmbeddingConfigured(),
  };
}

export async function getKnowledgeOverviewData(): Promise<KnowledgeOverviewData> {
  const supabase = await createClient();
  const [
    sourceCountResult,
    embeddingCountResult,
    documentBacklogResult,
    resolvedCasesResult,
    aiResponsesCountResult,
    aiFeedbackResult,
    aiFollowedRunsResult,
    recentAiFeedbackResult,
    categoryFeedbackResult,
    followedTestsResult,
  ] = await Promise.all([
      supabase.from("embedding_sources").select("*", { count: "exact", head: true }),
      supabase.from("embeddings").select("*", { count: "exact", head: true }),
      supabase
        .from("technical_documents")
        .select("*", { count: "exact", head: true })
        .eq("is_indexed", false),
      supabase
        .from("resolved_cases")
        .select(
          `
            id,
            case_status,
            resolution_summary,
            created_at,
            diagnostics(equipment_label)
          `,
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase.from("ai_responses").select("*", { count: "exact", head: true }),
      supabase
        .from("ai_response_feedback")
        .select("id, feedback_rating", { count: "exact" })
        .order("created_at", { ascending: false }),
      supabase
        .from("diagnostic_test_runs")
        .select("requested_by_ai_response_id")
        .not("requested_by_ai_response_id", "is", null),
      supabase
        .from("ai_response_feedback")
        .select(
          `
            id,
            diagnostic_id,
            feedback_rating,
            was_followed,
            note,
            created_at,
            users(full_name)
          `,
        )
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("ai_response_feedback")
        .select(
          `
            id,
            feedback_rating,
            was_followed,
            diagnostics(equipment_categories(name))
          `,
        ),
      supabase
        .from("diagnostic_test_runs")
        .select(
          `
            requested_by_ai_response_id,
            tests(name)
          `,
        )
        .not("requested_by_ai_response_id", "is", null),
    ]);

  const feedbackRows =
    (aiFeedbackResult.data as Array<{ id: string; feedback_rating: string }> | null) ?? [];
  const followedResponseIds = new Set(
    ((aiFollowedRunsResult.data as Array<{ requested_by_ai_response_id: string | null }> | null) ??
      [])
      .map((item) => item.requested_by_ai_response_id)
      .filter((item): item is string => Boolean(item)),
  );
  const categoryMetricsMap = new Map<
    string,
    { category: string; feedbackCount: number; helpfulCount: number; followedCount: number }
  >();

  for (const row of
    ((categoryFeedbackResult.data as Array<{
      feedback_rating: string;
      was_followed: boolean | null;
      diagnostics: { equipment_categories: { name: string } | Array<{ name: string }> | null } | null;
    }> | null) ?? [])) {
    const diagnostic = pickRelation(row.diagnostics);
    const category = pickRelation(diagnostic?.equipment_categories)?.name ?? "Nao classificado";
    const entry = categoryMetricsMap.get(category) ?? {
      category,
      feedbackCount: 0,
      helpfulCount: 0,
      followedCount: 0,
    };

    entry.feedbackCount += 1;

    if (row.feedback_rating === "helpful") {
      entry.helpfulCount += 1;
    }

    if (row.was_followed === true) {
      entry.followedCount += 1;
    }

    categoryMetricsMap.set(category, entry);
  }

  const followedTestCounts = new Map<string, number>();

  for (const row of
    ((followedTestsResult.data as Array<{
      requested_by_ai_response_id: string | null;
      tests: { name: string } | Array<{ name: string }> | null;
    }> | null) ?? [])) {
    const testName = pickRelation(row.tests)?.name ?? "Teste sugerido";
    followedTestCounts.set(testName, (followedTestCounts.get(testName) ?? 0) + 1);
  }

  return {
    provider: getEmbeddingProviderName(),
    externalProviderConfigured: isExternalEmbeddingConfigured(),
    sourceCount: sourceCountResult.count ?? 0,
    embeddingCount: embeddingCountResult.count ?? 0,
    pendingDocumentCount: documentBacklogResult.count ?? 0,
    aiMetrics: {
      totalResponses: aiResponsesCountResult.count ?? 0,
      feedbackCount: aiFeedbackResult.count ?? 0,
      followedCount: followedResponseIds.size,
      helpfulCount: feedbackRows.filter((item) => item.feedback_rating === "helpful").length,
      partiallyHelpfulCount: feedbackRows.filter(
        (item) => item.feedback_rating === "partially_helpful",
      ).length,
      notHelpfulCount: feedbackRows.filter((item) => item.feedback_rating === "not_helpful").length,
    },
    aiCategoryBreakdown: [...categoryMetricsMap.values()].sort(
      (a, b) => b.feedbackCount - a.feedbackCount || a.category.localeCompare(b.category),
    ),
    topFollowedTests: [...followedTestCounts.entries()]
      .map(([testName, count]) => ({
        testName,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.testName.localeCompare(b.testName))
      .slice(0, 5),
    recentResolvedCases: (resolvedCasesResult.data ?? []).map((item) => {
      const diagnostic = pickRelation(item.diagnostics);

      return {
        id: item.id,
        label: diagnostic?.equipment_label ?? "Caso resolvido",
        status: item.case_status,
        summary: item.resolution_summary,
        createdAt: formatRelativeTime(item.created_at),
      };
    }),
    recentAiFeedback: (recentAiFeedbackResult.data ?? []).map((item) => {
      const user = pickRelation(item.users);

      return {
        id: item.id,
        diagnosticId: item.diagnostic_id,
        rating: item.feedback_rating as "helpful" | "partially_helpful" | "not_helpful",
        wasFollowed: item.was_followed ?? null,
        note: item.note ?? "",
        submittedBy: user?.full_name ?? "Tecnico interno",
        createdAt: formatRelativeTime(item.created_at),
      };
    }),
  };
}
