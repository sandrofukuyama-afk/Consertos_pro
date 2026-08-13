import { createClient } from "@/lib/supabase/server";
import { extractFirstSentence, formatRelativeTime } from "@/lib/utils";
import type { DashboardData, DiagnosticCase, Kpi } from "@/types/domain";

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function mapStatus(status: string): DiagnosticCase["status"] {
  if (status === "waiting_input") {
    return "Aguardando teste";
  }

  if (status === "unresolved") {
    return "Encerrado sem solução";
  }

  if (status === "resolved") {
    return "Resolvido hoje";
  }

  if (status === "archived") {
    return "Encerrado sem solução";
  }

  return "Ativo";
}

function isComputerQueueCategory(categoryName: string | null | undefined) {
  const normalized = (categoryName ?? "")
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return ["computador", "desktop", "notebook"].some((term) =>
    normalized.includes(term),
  );
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const diagnosticsResult = await supabase
    .from("diagnostics")
    .select(
      `
        id,
        status,
        equipment_label,
        equipment_serial_number,
        current_summary,
        initial_problem_report,
        updated_at,
        equipment_categories(name),
        equipment_models(model_name),
        manufacturers(name)
      `,
    )
    .order("updated_at", { ascending: false })
    .limit(24);

  const diagnosticsRows = diagnosticsResult.data ?? [];

  const diagnosticIds = diagnosticsRows.map((row) => row.id);

  const [testRunsResult, aiResponsesResult] = diagnosticIds.length
    ? await Promise.all([
        supabase
          .from("diagnostic_test_runs")
          .select(
            `
              diagnostic_id,
              performed_at,
              procedure_notes,
              conclusion,
              tests(name)
            `,
          )
          .in("diagnostic_id", diagnosticIds)
          .order("performed_at", { ascending: false }),
        supabase
          .from("ai_responses")
          .select("diagnostic_id, recommended_next_step, created_at")
          .in("diagnostic_id", diagnosticIds)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const latestTestByDiagnostic = new Map<string, string>();
  for (const row of testRunsResult.data ?? []) {
    if (latestTestByDiagnostic.has(row.diagnostic_id)) {
      continue;
    }

    const test = pickRelation(row.tests);
    latestTestByDiagnostic.set(
      row.diagnostic_id,
      test?.name ?? row.conclusion ?? row.procedure_notes ?? "Não registrado",
    );
  }

  const nextStepByDiagnostic = new Map<string, string>();
  for (const row of aiResponsesResult.data ?? []) {
    if (nextStepByDiagnostic.has(row.diagnostic_id)) {
      continue;
    }

    nextStepByDiagnostic.set(
      row.diagnostic_id,
      row.recommended_next_step?.trim() || "Não registrado",
    );
  }

  const diagnostics = diagnosticsRows.map((row) => {
    const model = pickRelation(row.equipment_models);
    const manufacturer = pickRelation(row.manufacturers);
    const category = pickRelation(row.equipment_categories);

    const modelName =
      model?.model_name ??
      row.equipment_label ??
      row.equipment_serial_number ??
      manufacturer?.name ??
      "Equipamento sem modelo";

    return {
      id: row.id.slice(0, 8).toUpperCase(),
      recordId: row.id,
      category: category?.name ?? "Não classificado",
      equipment: modelName,
      symptom: extractFirstSentence(
        row.current_summary ?? row.initial_problem_report,
      ),
      board: "Não registrado",
      updatedAt: formatRelativeTime(row.updated_at),
      lastTest: latestTestByDiagnostic.get(row.id) ?? "Não registrado",
      nextStep: nextStepByDiagnostic.get(row.id) ?? "Não registrado",
      status: mapStatus(row.status),
    } satisfies DiagnosticCase;
  });

  const queueDiagnostics = diagnostics.filter((item) => {
    const isOpenStatus =
      item.status === "Ativo" || item.status === "Aguardando teste";

    return isOpenStatus && isComputerQueueCategory(item.category);
  });

  const activeCount = queueDiagnostics.filter((item) => item.status === "Ativo").length;
  const waitingCount = queueDiagnostics.filter(
    (item) => item.status === "Aguardando teste",
  ).length;
  const resolvedCount = diagnostics.filter(
    (item) => item.status === "Resolvido hoje",
  ).length;

  const kpis: Kpi[] = [
    {
      label: "Ativos",
      value: String(activeCount),
      change: activeCount ? "na fila principal" : "sem itens ativos",
      tone: "teal",
    },
    {
      label: "Aguardando teste",
      value: String(waitingCount),
      change: waitingCount ? "pendentes de retorno" : "fila vazia",
      tone: "copper",
    },
    {
      label: "Resolvidos hoje",
      value: String(resolvedCount),
      change: resolvedCount ? "encerrados no fluxo atual" : "sem encerramentos",
      tone: "amber",
    },
  ];

  return {
    kpis,
    diagnostics: queueDiagnostics,
    documents: [],
    knowledgeItems: [],
    hasLiveData: diagnosticsRows.length > 0,
  };
}
