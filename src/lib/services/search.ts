import { createClient } from "@/lib/supabase/server";
import { getSemanticSearchResults } from "@/lib/services/semantic";
import { searchTechnicalLibrary } from "@/lib/services/technical-library-search";
import { formatRelativeTime } from "@/lib/utils";
import { isBoardviewFileFormat } from "@/lib/technical-assets.mjs";
import type {
  CatalogOption,
  SearchDiagnosticResult,
  SearchDocumentResult,
  SearchFilters,
  SearchPageData,
  SearchTechnicalFileResult,
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

function technicalFileTypeLabel(assetType: string, fileName: string) {
  const extension = fileName.includes(".") ? (fileName.split(".").pop() ?? "").toUpperCase() : "";

  switch (assetType) {
    case "schematic_pdf":
      return "Esquema PDF";
    case "boardview":
      return extension ? `Boardview ${extension}` : "Boardview";
    case "bios":
      return "BIOS";
    case "firmware":
      return "Firmware EC";
    case "datasheet":
      return "Datasheet";
    default:
      return extension || "Arquivo";
  }
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1048576).toFixed(1)} MB`;
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
  let technicalFiles: SearchPageData["technicalFiles"] = { total: 0, items: [] };

  // Biblioteca tecnica (esquemas, boardviews, BIOS): busca por palavras.
  if (filters.q && (filters.scope === "all" || filters.scope === "documents")) {
    const { total, results } = await searchTechnicalLibrary(supabase, filters.q, 20);
    technicalFiles = {
      total,
      items: results.map(
        (item): SearchTechnicalFileResult => ({
          id: item.id,
          title: item.displayName,
          fileName: item.originalFileName,
          typeLabel: technicalFileTypeLabel(item.assetType, item.originalFileName),
          sizeLabel: formatFileSize(item.fileSizeBytes),
          downloadHref: `/api/technical-assets/${item.id}/content?download=1`,
          labHref: isBoardviewFileFormat(item.fileFormat, item.originalFileName)
            ? `/boardview/lab?boardview_asset_id=${item.id}`
            : item.fileFormat === "pdf"
              ? `/boardview/lab?schematic_asset_id=${item.id}`
              : null,
        }),
      ),
    };
  }

  if (filters.scope === "all" || filters.scope === "diagnostics") {
    let diagnosticsQuery = supabase
      .from("diagnostics")
      .select(
        `
          id,
          status,
          equipment_label,
          equipment_serial_number,
          equipment_models(model_name),
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
        `equipment_label.ilike.${queryText},equipment_serial_number.ilike.${queryText},current_summary.ilike.${queryText},initial_problem_report.ilike.${queryText}`,
      );
    }

    const { data: diagnosticsRows } = await diagnosticsQuery;

    diagnostics = (diagnosticsRows ?? []).map((row) => {
      const category = pickRelation(row.equipment_categories);
      const manufacturer = pickRelation(row.manufacturers);
      const model = pickRelation(row.equipment_models);

      return {
        id: row.id,
        label:
          model?.model_name ??
          row.equipment_label ??
          row.equipment_serial_number ??
          row.id.slice(0, 8).toUpperCase(),
        category: category?.name ?? "Não classificado",
        manufacturer: manufacturer?.name ?? "Não identificado",
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
          manufacturer: manufacturer?.name ?? "Não informado",
          relation: model?.model_name ?? board?.board_code ?? "Referência geral",
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
    technicalFiles,
    semanticMatches: semantic.matches,
    semanticProvider: semantic.provider,
    externalProviderConfigured: semantic.externalProviderConfigured,
  };
}
