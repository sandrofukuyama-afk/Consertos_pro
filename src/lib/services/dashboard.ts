import {
  documents as fallbackDocuments,
  knowledgeItems as fallbackKnowledge,
} from "@/lib/mock-data";
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

  if (status === "resolved") {
    return "Resolvido hoje";
  }

  return "Ativo";
}

export async function getDashboardData(): Promise<DashboardData> {
  const supabase = await createClient();

  const [diagnosticsResult, documentsResult, causesResult] = await Promise.all([
    supabase
      .from("diagnostics")
      .select(
        `
          id,
          status,
          equipment_label,
          current_summary,
          initial_problem_report,
          updated_at,
          equipment_categories(name),
          equipment_models(model_name),
          manufacturers(name),
          technician_profiles(display_name)
        `,
      )
      .order("updated_at", { ascending: false })
      .limit(8),
    supabase
      .from("technical_documents")
      .select(
        `
          title,
          document_type,
          equipment_models(model_name),
          boards(board_code)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("confirmed_causes")
      .select("title, cause_type")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const diagnosticsRows = diagnosticsResult.data ?? [];
  const documentsRows = documentsResult.data ?? [];
  const causesRows = causesResult.data ?? [];

  const diagnostics = diagnosticsRows.map((row) => {
    const model = pickRelation(row.equipment_models);
    const manufacturer = pickRelation(row.manufacturers);
    const technician = pickRelation(row.technician_profiles);
    const category = pickRelation(row.equipment_categories);

    const modelName =
      model?.model_name ??
      row.equipment_label ??
      manufacturer?.name ??
      "Equipamento sem modelo";

    return {
      id: row.id.slice(0, 8).toUpperCase(),
      recordId: row.id,
      category: category?.name ?? "Nao classificado",
      equipment: modelName,
      symptom: extractFirstSentence(
        row.current_summary ?? row.initial_problem_report,
      ),
      board: "Analise geral",
      technician: technician?.display_name ?? "Nao atribuido",
      updatedAt: formatRelativeTime(row.updated_at),
      status: mapStatus(row.status),
    } satisfies DiagnosticCase;
  });

  const activeCount = diagnosticsRows.filter((item) => item.status === "active").length;
  const waitingCount = diagnosticsRows.filter(
    (item) => item.status === "waiting_input",
  ).length;
  const resolvedCount = diagnosticsRows.filter(
    (item) => item.status === "resolved",
  ).length;

  const kpis: Kpi[] = [
    {
      label: "Ativos",
      value: String(activeCount),
      change: activeCount ? "casos em progresso" : "sem casos em progresso",
      tone: "teal",
    },
    {
      label: "Aguardando teste",
      value: String(waitingCount),
      change: waitingCount ? "itens aguardando retorno" : "fila vazia",
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
    diagnostics,
    documents:
      documentsRows.length > 0
        ? documentsRows.map((row) => {
            const model = pickRelation(row.equipment_models);
            const board = pickRelation(row.boards);

            return {
              title: row.title,
              type: row.document_type,
              relation: model?.model_name ?? board?.board_code ?? "Referencia geral",
            };
          })
        : fallbackDocuments,
    knowledgeItems:
      causesRows.length > 0
        ? causesRows.map((row) => ({
            cause: row.title,
            incidence: row.cause_type,
            note: "Conhecimento confirmado e pronto para consulta interna.",
          }))
        : fallbackKnowledge,
    hasLiveData: diagnosticsRows.length > 0,
  };
}
