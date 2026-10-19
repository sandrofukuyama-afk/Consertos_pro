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

const REPORT_TITLE_MAX_CHARS = 48;

function summarizeReportAsTitle(report: string | null | undefined) {
  const text = report?.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.length > REPORT_TITLE_MAX_CHARS ? `${text.slice(0, REPORT_TITLE_MAX_CHARS).trimEnd()}…` : text;
}

// Inicio do dia de hoje no Japao (UTC+9, sem horario de verao), em ISO/UTC.
function startOfTodayInJapanIso() {
  const japanNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const japanMidnightUtc = Date.UTC(
    japanNow.getUTCFullYear(),
    japanNow.getUTCMonth(),
    japanNow.getUTCDate(),
  );
  return new Date(japanMidnightUtc - 9 * 60 * 60 * 1000).toISOString();
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();
  const todayStart = startOfTodayInJapanIso();

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
        completed_at,
        equipment_categories(name),
        equipment_models(model_name),
        manufacturers(name)
      `,
    )
    .or(`status.in.(draft,active,waiting_input),completed_at.gte.${todayStart}`)
    .order("updated_at", { ascending: false })
    .limit(200);

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

    // Caso aberto pelo chat rapido nao tem modelo: o titulo vira o comeco do
    // relato (ex.: "ms1563 stealth 15m nao liga"). Com "Equipamento sem modelo"
    // os casos novos ficavam iguais na lista e pareciam nao ter aparecido.
    // A descricao do caso (digitada ou registrada pela IA, ex.: "MSI Stealth 15M
    // A11UEK (MS-1563)") vem antes do nome curto do catalogo ("MS 1563").
    const modelName =
      row.equipment_label ??
      model?.model_name ??
      row.equipment_serial_number ??
      manufacturer?.name ??
      summarizeReportAsTitle(row.initial_problem_report) ??
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

  // Todos os casos em andamento, de qualquer tipo de aparelho. Antes so entravam
  // categorias com "computador/desktop/notebook": casos abertos pelo chat rapido
  // ("Nao classificado") e TVs/celulares sumiam da lista em todos os aparelhos.
  const queueDiagnostics = diagnostics.filter(
    (item) => item.status === "Ativo" || item.status === "Aguardando teste",
  );

  const activeCount = queueDiagnostics.filter((item) => item.status === "Ativo").length;
  const waitingCount = queueDiagnostics.filter(
    (item) => item.status === "Aguardando teste",
  ).length;
  const resolvedCount = diagnosticsRows.filter(
    (row) => row.status === "resolved" && row.completed_at && row.completed_at >= todayStart,
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
