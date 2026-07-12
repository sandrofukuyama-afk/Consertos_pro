import { createClient } from "@/lib/supabase/server";
import { getSemanticSearchResults } from "@/lib/services/semantic";
import { formatRelativeTime } from "@/lib/utils";
import type {
  CatalogOption,
  SearchDiagnosticResult,
  SearchDocumentResult,
  SearchFilters,
  SearchPageData,
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

export async function getSearchPageData(
  input: Partial<SearchFilters>,
): Promise<SearchPageData> {
  const supabase = await createClient();

  const filters: SearchFilters = {
    q: input.q?.trim() ?? "",
    scope: (input.scope as SearchFilters["scope"]) || "all",
    status: input.status?.trim() ?? "",
    categoryId: input.categoryId?.trim() ?? "",
  };

  const { data: categoriesRows } = await supabase
    .from("equipment_categories")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  const categories = (categoriesRows ?? []) as CatalogOption[];
  const queryText = filters.q ? `%${filters.q}%` : null;
  const semantic = await getSemanticSearchResults(filters.q, supabase);

  let diagnostics: SearchDiagnosticResult[] = [];
  let documents: SearchDocumentResult[] = [];

  if (filters.scope === "all" || filters.scope === "diagnostics") {
    let diagnosticsQuery = supabase
      .from("diagnostics")
      .select(
        `
          id,
          status,
          equipment_label,
          current_summary,
          initial_problem_report,
          updated_at,
          equipment_categories(id, name),
          manufacturers(name)
        `,
      )
      .order("updated_at", { ascending: false })
      .limit(30);

    if (filters.status) {
      diagnosticsQuery = diagnosticsQuery.eq("status", filters.status);
    }

    if (filters.categoryId) {
      diagnosticsQuery = diagnosticsQuery.eq(
        "equipment_category_id",
        filters.categoryId,
      );
    }

    if (queryText) {
      diagnosticsQuery = diagnosticsQuery.or(
        `equipment_label.ilike.${queryText},current_summary.ilike.${queryText},initial_problem_report.ilike.${queryText}`,
      );
    }

    const { data: diagnosticsRows } = await diagnosticsQuery;

    diagnostics = (diagnosticsRows ?? []).map((row) => {
      const category = pickRelation(row.equipment_categories);
      const manufacturer = pickRelation(row.manufacturers);

      return {
        id: row.id,
        label: row.equipment_label ?? row.id.slice(0, 8).toUpperCase(),
        category: category?.name ?? "Nao classificado",
        manufacturer: manufacturer?.name ?? "Nao identificado",
        status: prettifyStatus(row.status),
        summary: row.current_summary ?? row.initial_problem_report,
        updatedAt: formatRelativeTime(row.updated_at),
      };
    });
  }

  if (filters.scope === "all" || filters.scope === "documents") {
    let documentsQuery = supabase
      .from("technical_documents")
      .select(
        `
          id,
          title,
          document_type,
          created_at,
          storage_path,
          manufacturers(name),
          equipment_models(model_name),
          boards(board_code)
        `,
      )
      .order("created_at", { ascending: false })
      .limit(30);

    if (queryText) {
      documentsQuery = documentsQuery.ilike("title", queryText);
    }

    const { data: documentRows } = await documentsQuery;

    documents = await Promise.all(
      (documentRows ?? []).map(async (row) => {
        const manufacturer = pickRelation(row.manufacturers);
        const model = pickRelation(row.equipment_models);
        const board = pickRelation(row.boards);

        const { data: signed } = await supabase.storage
          .from("technical-documents")
          .createSignedUrl(row.storage_path, 3600);

        return {
          id: row.id,
          title: row.title,
          documentType: prettifyStatus(row.document_type),
          manufacturer: manufacturer?.name ?? "Nao informado",
          relation: model?.model_name ?? board?.board_code ?? "Referencia geral",
          uploadedAt: formatRelativeTime(row.created_at),
          signedUrl: signed?.signedUrl ?? null,
        };
      }),
    );
  }

  return {
    filters,
    categories,
    diagnostics,
    documents,
    semanticMatches: semantic.matches,
    semanticProvider: semantic.provider,
    externalProviderConfigured: semantic.externalProviderConfigured,
  };
}
