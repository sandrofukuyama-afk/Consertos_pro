import { notFound } from "next/navigation";

import { getGuidedTreeForCategory, type GuidedTreeNode } from "@/lib/domain/guided-tree";
import { getDiagnosticAssistantSnapshot } from "@/lib/services/assistant";
import { getPreventiveInsightForModel } from "@/lib/services/statistics";
import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";
import type {
  ComponentAnnotation,
  DiagnosticDetail,
  SymptomOption,
  TechnicalLibraryItem,
  TechnicalDocumentListItem,
  TestOption,
} from "@/types/domain";

type DiagnosticBoardRow = {
  id: string;
  board_id: string | null;
  role_label: string;
  is_primary: boolean;
  boards:
    | { board_code: string | null; description: string | null }
    | Array<{ board_code: string | null; description: string | null }>
    | null;
};

type AttachmentAnalysis = {
  observations?: string[];
  suspectedIssues?: string[];
  confidence?: string;
  recommendation?: string;
};

type AttachmentRow = {
  id: string;
  title: string;
  description: string | null;
  attachment_type: string;
  mime_type: string;
  created_at: string;
  storage_path: string;
  ai_image_analysis: AttachmentAnalysis | null;
  ai_image_analyzed_at: string | null;
  annotations: ComponentAnnotation[] | null;
};

type ReferenceMeasurementRow = {
  id: string;
  board_id: string;
  component_ref: string;
  measurement_point: string;
  expected_value: string;
  condition: string;
  notes: string | null;
  created_at: string;
  users:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
};

type TechnicalDocumentRow = {
  id: string;
  title: string;
  document_type: string;
  is_indexed: boolean | null;
  created_at: string;
  storage_path: string;
  manufacturers:
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  equipment_models:
    | { model_name: string | null }
    | Array<{ model_name: string | null }>
    | null;
  boards:
    | { board_code: string | null }
    | Array<{ board_code: string | null }>
    | null;
  components:
    | { component_ref: string | null }
    | Array<{ component_ref: string | null }>
    | null;
  document_chunks: Array<{ id: string }> | null;
};

type TechnicalAssetRow = {
  id: string;
  original_filename: string;
  asset_type: string;
  file_format: string;
  file_size_bytes: number;
  created_at: string;
  metadata: Record<string, unknown> | null;
  technical_asset_links:
    | Array<{
        board_id: string | null;
        equipment_model_id: string | null;
        boards:
          | { board_code: string | null }
          | Array<{ board_code: string | null }>
          | null;
        equipment_models:
          | { model_name: string | null }
          | Array<{ model_name: string | null }>
          | null;
      }>
    | null;
};

type DiagnosticTechnicalAssetLinkRow = {
  technical_asset_id: string;
  board_id: string | null;
  equipment_model_id: string | null;
  boards:
    | { board_code: string | null }
    | Array<{ board_code: string | null }>
    | null;
  equipment_models:
    | { model_name: string | null }
    | Array<{ model_name: string | null }>
    | null;
  technical_assets:
    | {
        id: string;
        original_filename: string;
        asset_type: string;
        file_format: string;
        file_size_bytes: number;
        created_at: string;
      }
    | Array<{
        id: string;
        original_filename: string;
        asset_type: string;
        file_format: string;
        file_size_bytes: number;
        created_at: string;
      }>
    | null;
};

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function prettifyStatus(value: string) {
  return value.replaceAll("_", " ");
}

function formatBytesLabel(bytes: number | null | undefined) {
  if (!bytes || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

function getTechnicalAssetTypeLabel(format: string, assetType: string) {
  switch (format) {
    case "brd":
      return "Boardview BRD";
    case "bdv":
      return "Boardview BDV";
    case "pdf":
      return assetType === "schematic_pdf" ? "Esquema PDF" : "PDF";
    case "bin":
      return "Firmware BIN";
    case "zip":
      return "Pacote ZIP";
    case "jpg":
      return "Foto JPG";
    case "png":
      return "Foto PNG";
    default:
      return prettifyStatus(assetType || format);
  }
}

function buildTechnicalAssetAssociation(
  row: TechnicalAssetRow,
) {
  const firstLink = row.technical_asset_links?.[0] ?? null;
  return {
    boardName: pickRelation(firstLink?.boards)?.board_code ?? null,
    modelName: pickRelation(firstLink?.equipment_models)?.model_name ?? null,
  };
}

function buildBoardLabel(
  board: {
    roleLabel: string;
    boardCode: string | null;
    name: string | null;
  } | null,
) {
  if (!board) {
    return "Placa nao informada";
  }

  return board.name ?? board.boardCode ?? board.roleLabel;
}

function formatEquipmentDetailValue(
  key: string,
  value: string | number | boolean,
) {
  if (typeof value === "boolean") {
    return value ? "Sim" : "Não";
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

function buildEquipmentDetailItems(details: Record<string, unknown> | null | undefined) {
  if (!details) {
    return [];
  }

  const labels: Record<string, string> = {
    manufacturingYear: "Ano de fabricação",
    accessoriesIncluded: "Acessórios",
    powerPresent: "Alimentação",
    powersOn: "Liga",
    screenCondition: "Condição da tela",
    tvScreenSizeInches: "Tela (pol)",
    tvScreenType: "Tipo de tela",
    tvKind: "Tipo de TV",
    tvResolution: "Resolução",
    tvPanelCode: "Código do painel",
    notebookProcessor: "Processador",
    notebookRamGb: "RAM (GB)",
    notebookStorageType: "Armazenamento",
    notebookStorageCapacityGb: "Capacidade (GB)",
    notebookScreenSizeInches: "Tela (pol)",
    notebookChargerIncluded: "Carregador",
    smartphoneStorageGb: "Armazenamento (GB)",
    smartphoneColor: "Cor",
    smartphoneDualSim: "Dual SIM",
    smartphoneBiometric: "Biometria",
    smartphoneNetworkType: "Rede",
    desktopProcessor: "Processador",
    desktopRamGb: "RAM (GB)",
    desktopStorageType: "Armazenamento",
    desktopStorageCapacityGb: "Capacidade (GB)",
    desktopDedicatedGpu: "Placa de vídeo",
    desktopPsuWatts: "Fonte (W)",
  };

  return Object.entries(details)
    .filter(
      ([, value]) =>
        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
    )
    .map(([key, value]) => ({
      label: labels[key] ?? key,
      value: formatEquipmentDetailValue(key, value as string | number | boolean),
    }));
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
        manufacturer_id,
        equipment_label,
        equipment_serial_number,
        equipment_details,
        current_summary,
        initial_problem_report,
        physical_condition_notes,
        created_at,
        equipment_model_id,
        equipment_categories(name, slug),
        manufacturers(name),
        equipment_models(model_name),
        users!diagnostics_opened_by_user_id_fkey(full_name),
        resolved_cases(
          case_status,
          resolution_summary,
          repair_outcome
        ),
        diagnostic_symptoms(
          id,
          severity,
          notes,
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
          expected_result,
          actual_result,
          conclusion,
          performed_at,
          tests(slug, name, test_group),
          users!diagnostic_test_runs_performed_by_user_id_fkey(full_name)
        ),
        ai_responses(
          id,
          response_role,
          reasoning_summary,
          recommended_next_step,
          raw_response_text,
          structured_response_json,
          created_at
        ),
        measurements(
          id,
          measurement_type,
          diagnostic_test_run_id,
          diagnostic_board_id,
          point_label,
          unit,
          measured_value_numeric,
          measured_value_text,
          expected_value_text,
          tolerance_text,
          measurement_context,
          is_out_of_range,
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
          ai_image_analyzed_at,
          annotations
        ),
        diagnostic_boards(
          id,
          board_id,
          role_label,
          is_primary,
          boards(board_code, description)
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
  const model = pickRelation(data.equipment_models);
  const openedBy = pickRelation(data.users);
  const resolvedCase = pickRelation(data.resolved_cases);
  const equipmentDetails = buildEquipmentDetailItems(
    (data.equipment_details as Record<string, unknown> | null | undefined) ?? null,
  );
  const fallbackLabel =
    [manufacturer?.name, category?.name].filter(Boolean).join(" ") || "Equipamento sem nome";
  const label = model?.model_name ?? data.equipment_label ?? fallbackLabel;

  const categorySlug = category?.slug ?? category?.name ?? "desktop";
  const tree = getGuidedTreeForCategory(categorySlug);

  const testRuns = [...(data.diagnostic_test_runs ?? [])].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
  );
  const measurementRows = [...(data.measurements ?? [])].sort(
    (a, b) => new Date(b.measured_at).getTime() - new Date(a.measured_at).getTime(),
  );
  const hypothesisRows = [...(data.hypotheses ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const attachmentRows = [...(data.attachments ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const path: Array<{
    id: string;
    label: string;
    description: string;
    done: boolean;
    status: "success" | "failed" | "inconclusive" | "current" | "pending";
    order: number;
  }> = [];

  let currentNodeId: string | null = "root";
  const visited = new Set<string>();
  let order = 1;

  while (currentNodeId && tree[currentNodeId]) {
    if (visited.has(currentNodeId)) {
      break;
    }
    visited.add(currentNodeId);

    const node: GuidedTreeNode = tree[currentNodeId];

    const matchingRun = testRuns.find((run) => {
      const test = pickRelation(run.tests);
      return test?.slug === node.testSlug && run.result_status !== "pending";
    });

    if (matchingRun) {
      let branch: "success" | "failed" | "inconclusive";
      if (matchingRun.result_status === "passed" || matchingRun.result_status === "success") {
        branch = "success";
      } else if (matchingRun.result_status === "failed") {
        branch = "failed";
      } else {
        branch = "inconclusive";
      }

      path.push({
        id: node.id,
        label: `${node.label} (${branch === "success" ? "Passou" : branch === "failed" ? "Falhou" : "Inconclusivo"})`,
        description: node.description,
        done: true,
        status: branch,
        order: order++,
      });

      currentNodeId = node.branches[branch];
    } else {
      path.push({
        id: node.id,
        label: node.label,
        description: node.description,
        done: false,
        status: "current",
        order: order++,
      });

      if (!node.branches.success && !node.branches.failed && !node.branches.inconclusive) {
        currentNodeId = null;
      } else {
        let nextPreviewId =
          node.branches.success ?? node.branches.inconclusive ?? node.branches.failed;
        while (nextPreviewId && tree[nextPreviewId] && !visited.has(nextPreviewId)) {
          visited.add(nextPreviewId);
          const nextNode = tree[nextPreviewId];
          path.push({
            id: nextNode.id,
            label: nextNode.label,
            description: nextNode.description,
            done: false,
            status: "pending",
            order: order++,
          });
          nextPreviewId =
            nextNode.branches.success ?? nextNode.branches.inconclusive ?? nextNode.branches.failed;
        }
        currentNodeId = null;
      }
    }
  }

  const guidedFlow = path;

  const attachmentItems = attachmentRows as AttachmentRow[];
  const attachmentPaths = attachmentItems.map((item) => item.storage_path);

  const signedUrlsMap: Record<string, string> = {};
  if (attachmentPaths.length > 0) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from("diagnostic-attachments")
      .createSignedUrls(attachmentPaths, 3600);

    if (signedData && !signedError) {
      signedData.forEach((urlItem) => {
        if (urlItem.signedUrl && urlItem.path) {
          signedUrlsMap[urlItem.path] = urlItem.signedUrl;
        }
      });
    }
  }

  const diagnosticBoards = ((data.diagnostic_boards ?? []) as DiagnosticBoardRow[]).map((item) => {
    const board = pickRelation(item.boards);
    return {
      id: item.id,
      boardId: item.board_id,
      roleLabel: item.role_label,
      isPrimary: item.is_primary,
      boardCode: board?.board_code ?? null,
      name: board?.description ?? board?.board_code ?? null,
    };
  });

  const diagnosticBoardMap = new Map(
    diagnosticBoards.map((board) => [board.id, board] as const),
  );

  const boardIds = diagnosticBoards
    .map((board) => board.boardId)
    .filter((id): id is string => Boolean(id));

  const technicalAssetLinkFilters: string[] = [];

  if (data.equipment_model_id) {
    technicalAssetLinkFilters.push(`equipment_model_id.eq.${data.equipment_model_id}`);
  }

  if (boardIds.length) {
    technicalAssetLinkFilters.push(`board_id.in.(${boardIds.join(",")})`);
  }

  const [
    attachmentsList,
    assistantSnapshot,
    preventiveInsight,
    referenceMeasurements,
    technicalAssetLinksResult,
  ] =
    await Promise.all([
      Promise.resolve(
        attachmentItems.map((item) => {
          const signedUrl = signedUrlsMap[item.storage_path] ?? null;

          const analysis = item.ai_image_analysis;

          return {
            id: item.id,
            title: item.title,
            description: item.description ?? "Sem descricao.",
            attachmentType: prettifyStatus(item.attachment_type),
            mimeType: item.mime_type,
            uploadedAt: formatRelativeTime(item.created_at),
            signedUrl,
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
            annotations: item.annotations ?? [],
          };
        }),
      ),
      getDiagnosticAssistantSnapshot(diagnosticId, supabase),
      data.equipment_model_id
        ? getPreventiveInsightForModel(data.equipment_model_id, diagnosticId, supabase)
        : Promise.resolve(null),
      boardIds.length > 0
        ? supabase
            .from("board_measurements")
            .select(`
            id,
            board_id,
            component_ref,
            measurement_point,
            expected_value,
            condition,
            notes,
            created_at,
            users(full_name)
          `)
            .in("board_id", boardIds)
            .order("component_ref")
            .then((res) => {
              return ((res.data ?? []) as ReferenceMeasurementRow[]).map((item) => {
                const user = pickRelation(item.users);
                return {
                  id: item.id,
                  boardId: item.board_id,
                  componentRef: item.component_ref,
                  measurementPoint: item.measurement_point,
                  expectedValue: item.expected_value,
                  condition: item.condition,
                  notes: item.notes,
                  createdAt: formatRelativeTime(item.created_at),
                  userName: user?.full_name ?? "Tecnico interno",
                };
              });
            })
        : Promise.resolve([]),
      technicalAssetLinkFilters.length > 0
        ? supabase
            .from("technical_asset_links")
            .select(
              `
                technical_asset_id,
                board_id,
                equipment_model_id,
                boards(board_code),
                equipment_models(model_name),
                technical_assets(
                  id,
                  original_filename,
                  asset_type,
                  file_format,
                  file_size_bytes,
                  created_at
                )
              `,
            )
            .or(technicalAssetLinkFilters.join(","))
        : Promise.resolve({ data: [] as DiagnosticTechnicalAssetLinkRow[] }),
    ]);

  const attachments = attachmentsList;

  const timeline = [
    ...(data.diagnostic_symptoms ?? []).map((item) => {
      const symptom = pickRelation(item.symptoms);

      return {
        id: `symptom-${item.id}`,
        kind: "Sintoma",
        title: symptom?.name ?? "Sintoma registrado",
        description: item.notes ?? item.severity ?? "Sem severidade informada.",
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
        description:
          item.actual_result ??
          item.conclusion ??
          item.procedure_notes ??
          "Sem resultado registrado.",
        happenedAt: item.performed_at ?? new Date().toISOString(),
      };
    }),
    ...(data.ai_responses ?? []).map((item) => ({
      id: `ai-response-${item.id}`,
      kind: item.response_role === "user" ? "Pergunta" : "IA",
      title:
        item.response_role === "user"
          ? "Pergunta da bancada registrada"
          : "Recomendacao tecnica registrada",
      description:
        item.response_role === "user"
          ? item.raw_response_text ?? item.reasoning_summary ?? "Pergunta sem texto."
          : item.recommended_next_step ??
            item.reasoning_summary ??
            item.raw_response_text ??
            "Leitura tecnica salva para orientar o proximo passo.",
      happenedAt: item.created_at ?? new Date().toISOString(),
    })),
    ...(data.measurements ?? []).map((item) => ({
      id: `measurement-${item.id}`,
      kind: "Medicao",
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
      kind: "Hipotese",
      title: item.title,
      description: item.evidence_summary ?? item.description ?? "Hipotese adicionada.",
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

  const technicalAssets = Array.from(
    new Map(
      ((technicalAssetLinksResult.data ?? []) as DiagnosticTechnicalAssetLinkRow[])
        .map((linkRow) => {
          const asset = pickRelation(linkRow.technical_assets);
          if (!asset) {
            return null;
          }

          const boardName = pickRelation(linkRow.boards)?.board_code ?? null;
          const modelName = pickRelation(linkRow.equipment_models)?.model_name ?? null;
          const boardviewLabHref =
            asset.file_format === "brd" || asset.file_format === "bdv"
              ? `/boardview/lab?diagnostic_id=${data.id}&boardview_asset_id=${asset.id}`
              : asset.file_format === "pdf"
                ? `/boardview/lab?diagnostic_id=${data.id}&schematic_asset_id=${asset.id}`
                : null;

          return [
            asset.id,
            {
              id: asset.id,
              title: asset.original_filename,
              documentType: getTechnicalAssetTypeLabel(asset.file_format, asset.asset_type),
              fileFormat: asset.file_format,
              fileSizeLabel: formatBytesLabel(asset.file_size_bytes),
              uploadedAt: formatRelativeTime(asset.created_at),
              boardId: linkRow.board_id ?? null,
              equipmentModelId: linkRow.equipment_model_id ?? null,
              boardName,
              modelName,
              associationLabel: modelName ?? boardName ?? "Não associado",
              boardviewLabHref,
            },
          ] as const;
        })
        .filter(
          (
            entry,
          ): entry is readonly [
            string,
            DiagnosticDetail["technicalAssets"][number],
          ] => Boolean(entry),
        ),
    ).values(),
  ).sort((left, right) => left.title.localeCompare(right.title));

  return {
    id: data.id,
    manufacturerId: data.manufacturer_id ?? null,
    modelId: data.equipment_model_id ?? null,
    category: category?.name ?? "Nao classificado",
    manufacturer: manufacturer?.name ?? "Nao identificado",
    model: model?.model_name ?? "Nao informado",
    serialNumber: data.equipment_serial_number ?? "Nao informado",
    label,
    status: prettifyStatus(data.status),
    priority: prettifyStatus(data.priority),
    summary: data.current_summary ?? "Resumo ainda nao definido.",
    initialReport: data.initial_problem_report,
    physicalNotes: data.physical_condition_notes ?? "Sem observacoes fisicas.",
    equipmentDetails,
    openedBy: openedBy?.full_name ?? "Usuario interno",
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
        severity: item.severity ?? "nao informada",
        notes: item.notes ?? "Sem observacao adicional.",
        sourceType: prettifyStatus(item.source_type),
        isPrimary: item.is_primary,
        capturedAt: formatRelativeTime(item.captured_at),
      };
    }),
    tests: [...testRuns].reverse().map((item) => {
      const test = pickRelation(item.tests);
      const tech = pickRelation(item.users);

      return {
        id: item.id,
        testName: test?.name ?? "Teste",
        resultStatus: prettifyStatus(item.result_status),
        stepOrder: item.step_order,
        testGroup: test?.test_group ?? "Sem grupo",
        procedureNotes: item.procedure_notes ?? "Sem procedimento descrito.",
        expectedResult: item.expected_result ?? "Sem resultado esperado definido.",
        actualResult: item.actual_result ?? "Sem resultado final registrado.",
        conclusion: item.conclusion ?? "Sem conclusao registrada.",
        performedAt: formatRelativeTime(item.performed_at),
        technician: tech?.full_name ?? "Tecnico interno",
        requestedByAi: Boolean(item.requested_by_ai_response_id),
        requestedByAiResponseId: item.requested_by_ai_response_id ?? null,
      };
    }),
    measurements: measurementRows.map((item) => {
      const tech = pickRelation(item.users);
      const linkedTest = testRuns.find(
        (testRun) => testRun.id === item.diagnostic_test_run_id,
      );
      const linkedTestRelation = linkedTest ? pickRelation(linkedTest.tests) : null;
      const board = item.diagnostic_board_id
        ? diagnosticBoardMap.get(item.diagnostic_board_id) ?? null
        : null;
      const measuredValue =
        item.measured_value_text ??
        (item.measured_value_numeric !== null && item.measured_value_numeric !== undefined
          ? `${item.measured_value_numeric}${item.unit ? ` ${item.unit}` : ""}`
          : "Sem valor numerico");

      return {
        id: item.id,
        measurementType: prettifyStatus(item.measurement_type),
        pointLabel: item.point_label ?? "Ponto nao informado",
        measuredValue,
        expectedValue: item.expected_value_text ?? "Nao informado",
        tolerance: item.tolerance_text ?? "Sem tolerancia definida",
        context: item.measurement_context ?? "Sem contexto registrado.",
        isOutOfRange: item.is_out_of_range,
        linkedTestId: item.diagnostic_test_run_id ?? null,
        linkedTestName: linkedTestRelation?.name ?? null,
        boardLabel: buildBoardLabel(board),
        measuredAt: formatRelativeTime(item.measured_at),
        technician: tech?.full_name ?? "Tecnico interno",
      };
    }),
    hypotheses: hypothesisRows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? "Sem descricao complementar.",
      status: prettifyStatus(item.status),
      confidence:
        item.confidence_score !== null && item.confidence_score !== undefined
          ? String(item.confidence_score)
          : "0",
      evidence: item.evidence_summary ?? "Sem evidencia registrada.",
      createdAt: formatRelativeTime(item.created_at),
    })),
    attachments,
    timeline,
    assistantSnapshot,
    boards: diagnosticBoards,
    referenceMeasurements,
    technicalAssets,
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
        components(component_ref),
        document_chunks(id)
      `,
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const items = await Promise.all(
    ((data ?? []) as TechnicalDocumentRow[]).map(async (row) => {
      const manufacturer = pickRelation(row.manufacturers);
      const model = pickRelation(row.equipment_models);
      const board = pickRelation(row.boards);
      const component = pickRelation(row.components);
      const chunks = Array.isArray(row.document_chunks) ? row.document_chunks : [];
      const { data: signed } = await supabase.storage
        .from("technical-documents")
        .createSignedUrl(row.storage_path, 3600);

      return {
        id: row.id,
        title: row.title,
        documentType: prettifyStatus(row.document_type),
        fileFormat: row.document_type,
        manufacturer: manufacturer?.name ?? "Nao informado",
        relation:
          model?.model_name ?? board?.board_code ?? component?.component_ref ?? "Referencia geral",
        uploadedAt: formatRelativeTime(row.created_at),
        uploadedAtIso: row.created_at,
        chunksCount: chunks.length,
        isIndexed: row.is_indexed || chunks.length > 0,
        signedUrl: signed?.signedUrl ?? null,
      } satisfies TechnicalDocumentListItem;
    }),
  );

  return items;
}

export async function getTechnicalLibraryItems() {
  const supabase = await createClient();

  const [documents, technicalAssetsResult] = await Promise.all([
    getTechnicalDocuments(),
    supabase
      .from("technical_assets")
      .select(`
        id,
        original_filename,
        asset_type,
        file_format,
        file_size_bytes,
        created_at,
        metadata,
        technical_asset_links(
          board_id,
          equipment_model_id,
          boards(board_code),
          equipment_models(model_name)
        )
      `)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const assetItems = ((technicalAssetsResult.data ?? []) as TechnicalAssetRow[]).map((row) => {
    const association = buildTechnicalAssetAssociation(row);
    const associationLabel = association.modelName ?? association.boardName ?? "Nao associado";
    const metadata = row.metadata ?? {};
    const displayName =
      typeof metadata.display_name === "string" && metadata.display_name.trim()
        ? metadata.display_name.trim()
        : row.original_filename;
    const description =
      typeof metadata.description === "string" && metadata.description.trim()
        ? metadata.description.trim()
        : null;
    const manufacturerName =
      typeof metadata.manufacturer_name === "string" && metadata.manufacturer_name.trim()
        ? metadata.manufacturer_name.trim()
        : "Biblioteca tecnica";
    const manufacturerId =
      typeof metadata.manufacturer_id === "string" && metadata.manufacturer_id.trim()
        ? metadata.manufacturer_id.trim()
        : null;
    const boardId = row.technical_asset_links?.[0]?.board_id ?? null;
    const equipmentModelId = row.technical_asset_links?.[0]?.equipment_model_id ?? null;
    const boardviewLabHref =
      row.file_format === "brd" || row.file_format === "bdv"
        ? `/boardview/lab?boardview_asset_id=${row.id}`
        : row.file_format === "pdf"
          ? `/boardview/lab?schematic_asset_id=${row.id}`
          : null;

    return {
      id: row.id,
      source: "technical_asset",
      title: displayName,
      originalFileName: row.original_filename,
      documentType: getTechnicalAssetTypeLabel(row.file_format, row.asset_type),
      fileFormat: row.file_format,
      manufacturer: manufacturerName,
      manufacturerId,
      relation: association.modelName ?? association.boardName ?? "Nao associado",
      boardId,
      equipmentModelId,
      uploadedAt: formatRelativeTime(row.created_at),
      uploadedAtIso: row.created_at,
      signedUrl: null,
      chunksCount: null,
      isIndexed: null,
      fileSizeLabel: formatBytesLabel(row.file_size_bytes),
      associationStatus:
        association.boardName || association.modelName ? "associated" : "unassociated",
      associationLabel,
      boardviewLabHref,
      description,
    } satisfies TechnicalLibraryItem;
  });

  const legacyItems = documents.map((item) => ({
    id: item.id,
    source: "technical_document",
    title: item.title,
    originalFileName: null,
    documentType: item.documentType,
    fileFormat: item.fileFormat,
    manufacturer: item.manufacturer,
    manufacturerId: null,
    relation: item.relation,
    boardId: null,
    equipmentModelId: null,
    uploadedAt: item.uploadedAt,
    uploadedAtIso: item.uploadedAtIso,
    signedUrl: item.signedUrl,
    chunksCount: item.chunksCount,
    isIndexed: item.isIndexed,
    fileSizeLabel: null,
    associationStatus: "legacy" as const,
    associationLabel: null,
    boardviewLabHref: null,
    description: null,
  })) satisfies TechnicalLibraryItem[];

  return [...assetItems, ...legacyItems].sort((left, right) =>
    right.uploadedAtIso.localeCompare(left.uploadedAtIso),
  );
}
