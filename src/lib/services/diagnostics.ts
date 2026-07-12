import { notFound } from "next/navigation";

import { getGuidedFlowForCategory } from "@/lib/domain/guided-flows";
import { getDiagnosticAssistantSnapshot } from "@/lib/services/assistant";
import { getPreventiveInsightForModel } from "@/lib/services/statistics";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";
import type {
  DiagnosticDetail,
  SymptomOption,
  TechnicalDocumentListItem,
  TestOption,
} from "@/types/domain";

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function prettifyStatus(value: string) {
  return value.replaceAll("_", " ");
}

export async function getDiagnosticDetail(diagnosticId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
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
        created_at,
        equipment_model_id,
        equipment_categories(name),
        manufacturers(name),
        users!diagnostics_opened_by_user_id_fkey(full_name),
        resolved_cases(
          case_status,
          resolution_summary,
          repair_outcome
        ),
        diagnostic_symptoms(
          id,
          severity,
          source_type,
          is_primary,
          captured_at,
          symptoms(name)
        ),
        diagnostic_test_runs(
          id,
          step_order,
          requested_by_ai_response_id,
          result_status,
          procedure_notes,
          actual_result,
          performed_at,
          tests(name, test_group),
          users!diagnostic_test_runs_performed_by_user_id_fkey(full_name)
        ),
        ai_responses(
          id,
          reasoning_summary,
          recommended_next_step,
          created_at
        ),
        measurements(
          id,
          measurement_type,
          point_label,
          unit,
          measured_value_numeric,
          measured_value_text,
          expected_value_text,
          measured_at,
          users!measurements_measured_by_user_id_fkey(full_name)
        ),
        hypotheses(
          id,
          title,
          description,
          status,
          confidence_score,
          evidence_summary,
          created_at
        ),
        attachments(
          id,
          title,
          description,
          attachment_type,
          mime_type,
          created_at,
          storage_path,
          ai_image_analysis,
          ai_image_analyzed_at
        )
      `,
    )
    .eq("id", diagnosticId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const category = pickRelation(data.equipment_categories);
  const manufacturer = pickRelation(data.manufacturers);
  const openedBy = pickRelation(data.users);
  const resolvedCase = pickRelation(data.resolved_cases);

  const completedTestGroups = new Set(
    (data.diagnostic_test_runs ?? [])
      .filter((item: { result_status: string }) => item.result_status !== "pending")
      .map((item: { tests: { test_group: string | null } | Array<{ test_group: string | null }> | null }) =>
        pickRelation(item.tests)?.test_group,
      )
      .filter((group: string | null | undefined): group is string => Boolean(group)),
  );

  const guidedFlow = getGuidedFlowForCategory(category?.name ?? "desktop").map((step) => ({
    order: step.order,
    label: step.label,
    description: step.description,
    done: completedTestGroups.has(step.testGroup),
  }));

  const [attachments, assistantSnapshot, preventiveInsight] = await Promise.all([
    Promise.all(
      (data.attachments ?? []).map(async (item) => {
        const { data: signed } = await supabase.storage
          .from("diagnostic-attachments")
          .createSignedUrl(item.storage_path, 3600);

        const analysis = item.ai_image_analysis as {
          observations?: string[];
          suspectedIssues?: string[];
          confidence?: string;
          recommendation?: string;
        } | null;

        return {
          id: item.id,
          title: item.title,
          description: item.description ?? "Sem descrição.",
          attachmentType: prettifyStatus(item.attachment_type),
          mimeType: item.mime_type,
          uploadedAt: formatRelativeTime(item.created_at),
          signedUrl: signed?.signedUrl ?? null,
          imageAnalysis:
            analysis && item.ai_image_analyzed_at
              ? {
                  observations: analysis.observations ?? [],
                  suspectedIssues: analysis.suspectedIssues ?? [],
                  confidence: analysis.confidence ?? "low",
                  recommendation: analysis.recommendation ?? "",
                  analyzedAt: formatRelativeTime(item.ai_image_analyzed_at),
                }
              : null,
        };
      }),
    ),
    getDiagnosticAssistantSnapshot(diagnosticId, supabase),
    data.equipment_model_id
      ? getPreventiveInsightForModel(data.equipment_model_id, diagnosticId, supabase)
      : Promise.resolve(null),
  ]);

  const timeline = [
    ...(data.diagnostic_symptoms ?? []).map((item) => {
      const symptom = pickRelation(item.symptoms);

      return {
        id: `symptom-${item.id}`,
        kind: "Sintoma",
        title: symptom?.name ?? "Sintoma registrado",
        description: item.severity ?? "Sem severidade informada.",
        happenedAt: item.captured_at ?? new Date().toISOString(),
      };
    }),
    ...(data.diagnostic_test_runs ?? []).map((item) => {
      const test = pickRelation(item.tests);

      return {
        id: `test-${item.id}`,
        kind: "Teste",
        title: item.requested_by_ai_response_id
          ? `${test?.name ?? "Teste executado"} sugerido pela IA`
          : test?.name ?? "Teste executado",
        description: item.actual_result ?? item.procedure_notes ?? "Sem resultado registrado.",
        happenedAt: item.performed_at ?? new Date().toISOString(),
      };
    }),
    ...(data.ai_responses ?? []).map((item) => ({
      id: `ai-response-${item.id}`,
      kind: "IA",
      title: "Recomendação técnica registrada",
      description:
        item.recommended_next_step ??
        item.reasoning_summary ??
        "Leitura técnica salva para orientar o próximo passo.",
      happenedAt: item.created_at ?? new Date().toISOString(),
    })),
    ...(data.measurements ?? []).map((item) => ({
      id: `measurement-${item.id}`,
      kind: "Medição",
      title: item.point_label ?? "Leitura registrada",
      description:
        item.measured_value_text ??
        (item.measured_value_numeric !== null && item.measured_value_numeric !== undefined
          ? `${item.measured_value_numeric}${item.unit ? ` ${item.unit}` : ""}`
          : "Sem valor informado."),
      happenedAt: item.measured_at ?? new Date().toISOString(),
    })),
    ...(data.hypotheses ?? []).map((item) => ({
      id: `hypothesis-${item.id}`,
      kind: "Hipótese",
      title: item.title,
      description: item.evidence_summary ?? item.description ?? "Hipótese adicionada.",
      happenedAt: item.created_at ?? new Date().toISOString(),
    })),
    ...(data.attachments ?? []).map((item) => ({
      id: `attachment-${item.id}`,
      kind: "Anexo",
      title: item.title,
      description: item.description ?? "Arquivo anexado ao caso.",
      happenedAt: item.created_at ?? new Date().toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.happenedAt).getTime() - new Date(a.happenedAt).getTime())
    .map((item) => ({
      ...item,
      happenedAt: formatRelativeTime(item.happenedAt),
    }));

  return {
    id: data.id,
    category: category?.name ?? "Não classificado",
    manufacturer: manufacturer?.name ?? "Não identificado",
    label: data.equipment_label ?? "Sem etiqueta",
    status: prettifyStatus(data.status),
    priority: prettifyStatus(data.priority),
    summary: data.current_summary ?? "Resumo ainda não definido.",
    initialReport: data.initial_problem_report,
    physicalNotes: data.physical_condition_notes ?? "Sem observações físicas.",
    openedBy: openedBy?.full_name ?? "Usuário interno",
    createdAt: formatRelativeTime(data.created_at),
    preventiveInsight,
    guidedFlow,
    resolvedCase: resolvedCase
      ? {
          caseStatus: prettifyStatus(resolvedCase.case_status),
          resolutionSummary: resolvedCase.resolution_summary,
          repairOutcome: resolvedCase.repair_outcome,
        }
      : null,
    symptoms: (data.diagnostic_symptoms ?? []).map((item) => {
      const symptom = pickRelation(item.symptoms);

      return {
        id: item.id,
        name: symptom?.name ?? "Sintoma",
        severity: item.severity ?? "não informada",
        sourceType: prettifyStatus(item.source_type),
        isPrimary: item.is_primary,
        capturedAt: formatRelativeTime(item.captured_at),
      };
    }),
    tests: (data.diagnostic_test_runs ?? []).map((item) => {
      const test = pickRelation(item.tests);
      const tech = pickRelation(item.users);

      return {
        id: item.id,
        testName: test?.name ?? "Teste",
        resultStatus: prettifyStatus(item.result_status),
        stepOrder: item.step_order,
        procedureNotes: item.procedure_notes ?? "Sem procedimento descrito.",
        actualResult: item.actual_result ?? "Sem resultado final registrado.",
        performedAt: formatRelativeTime(item.performed_at),
        technician: tech?.full_name ?? "Técnico interno",
        requestedByAi: Boolean(item.requested_by_ai_response_id),
        requestedByAiResponseId: item.requested_by_ai_response_id ?? null,
      };
    }),
    measurements: (data.measurements ?? []).map((item) => {
      const tech = pickRelation(item.users);
      const measuredValue =
        item.measured_value_text ??
        (item.measured_value_numeric !== null && item.measured_value_numeric !== undefined
          ? `${item.measured_value_numeric}${item.unit ? ` ${item.unit}` : ""}`
          : "Sem valor numérico");

      return {
        id: item.id,
        measurementType: prettifyStatus(item.measurement_type),
        pointLabel: item.point_label ?? "Ponto não informado",
        measuredValue,
        expectedValue: item.expected_value_text ?? "Não informado",
        measuredAt: formatRelativeTime(item.measured_at),
        technician: tech?.full_name ?? "Técnico interno",
      };
    }),
    hypotheses: (data.hypotheses ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? "Sem descrição complementar.",
      status: prettifyStatus(item.status),
      confidence:
        item.confidence_score !== null && item.confidence_score !== undefined
          ? String(item.confidence_score)
          : "0",
      evidence: item.evidence_summary ?? "Sem evidência registrada.",
      createdAt: formatRelativeTime(item.created_at),
    })),
    attachments,
    timeline,
    assistantSnapshot,
  } satisfies DiagnosticDetail;
}

export async function getDiagnosticFormOptions(diagnosticId: string) {
  const supabase = await createClient();

  const { data: diagnostic } = await supabase
    .from("diagnostics")
    .select("equipment_category_id")
    .eq("id", diagnosticId)
    .maybeSingle();

  const [symptomsResult, testsResult] = await Promise.all([
    diagnostic?.equipment_category_id
      ? supabase
          .from("symptoms")
          .select("id, name, symptom_group")
          .eq("equipment_category_id", diagnostic.equipment_category_id)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] as SymptomOption[] }),
    supabase
      .from("tests")
      .select("id, name, test_group, default_unit")
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    symptoms: (symptomsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      group: "symptom_group" in item ? item.symptom_group : null,
    })) as SymptomOption[],
    tests: (testsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      group: item.test_group,
      unit: item.default_unit,
    })) as TestOption[],
  };
}

export async function getTechnicalDocuments() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("technical_documents")
    .select(
      `
        id,
        title,
        document_type,
        is_indexed,
        created_at,
        storage_path,
        manufacturers(name),
        equipment_models(model_name),
        boards(board_code),
        document_chunks(id)
      `,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const items = await Promise.all(
    (data ?? []).map(async (row) => {
      const manufacturer = pickRelation(row.manufacturers);
      const model = pickRelation(row.equipment_models);
      const board = pickRelation(row.boards);
      const chunks = Array.isArray(row.document_chunks) ? row.document_chunks : [];
      const { data: signed } = await supabase.storage
        .from("technical-documents")
        .createSignedUrl(row.storage_path, 3600);

      return {
        id: row.id,
        title: row.title,
        documentType: prettifyStatus(row.document_type),
        manufacturer: manufacturer?.name ?? "Não informado",
        relation: model?.model_name ?? board?.board_code ?? "Referência geral",
        uploadedAt: formatRelativeTime(row.created_at),
        chunksCount: chunks.length,
        isIndexed: row.is_indexed || chunks.length > 0,
        signedUrl: signed?.signedUrl ?? null,
      } satisfies TechnicalDocumentListItem;
    }),
  );

  return items;
}
