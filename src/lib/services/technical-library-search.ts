import type { SupabaseClient } from "@supabase/supabase-js";

export type TechnicalLibrarySearchResult = {
  id: string;
  originalFileName: string;
  displayName: string;
  assetType: string;
  fileFormat: string;
  fileSizeBytes: number;
  storageBucket: string;
  storagePath: string;
};

type TechnicalAssetSearchRow = {
  id: string;
  original_filename: string;
  asset_type: string;
  file_format: string;
  file_size_bytes: number;
  storage_bucket: string;
  storage_path: string;
  metadata: Record<string, unknown> | null;
};

// Ordem de exibicao: o que mais ajuda no reparo primeiro.
const TYPE_ORDER: Record<string, number> = {
  schematic_pdf: 0,
  boardview: 1,
  bios: 2,
  firmware: 3,
  datasheet: 4,
};

export function tokenizeLibraryQuery(query: string) {
  return Array.from(
    new Set(
      query
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9.\-/ ]+/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 2),
    ),
  ).slice(0, 6);
}

/**
 * Busca na biblioteca tecnica: cada palavra precisa aparecer, em qualquer ordem,
 * no nome do arquivo ou no nome organizado (tipo, fabricante, modelo, placa).
 */
export async function searchTechnicalLibrary(
  supabase: SupabaseClient,
  query: string,
  limit = 50,
): Promise<{ total: number; results: TechnicalLibrarySearchResult[] }> {
  const tokens = tokenizeLibraryQuery(query);

  if (!tokens.length) {
    return { total: 0, results: [] };
  }

  let request = supabase
    .from("technical_assets")
    .select(
      "id, original_filename, asset_type, file_format, file_size_bytes, storage_bucket, storage_path, metadata",
      { count: "exact" },
    );

  for (const token of tokens) {
    request = request.or(
      `original_filename.ilike.%${token}%,metadata->>display_name.ilike.%${token}%`,
    );
  }

  const { data, error, count } = await request
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const results = ((data ?? []) as TechnicalAssetSearchRow[])
    .map((row) => ({
      id: row.id,
      originalFileName: row.original_filename,
      displayName:
        typeof row.metadata?.display_name === "string" && row.metadata.display_name.trim()
          ? row.metadata.display_name.trim()
          : row.original_filename,
      assetType: row.asset_type,
      fileFormat: row.file_format,
      fileSizeBytes: row.file_size_bytes,
      storageBucket: row.storage_bucket,
      storagePath: row.storage_path,
    }))
    .sort(
      (a, b) =>
        (TYPE_ORDER[a.assetType] ?? 9) - (TYPE_ORDER[b.assetType] ?? 9) ||
        a.displayName.localeCompare(b.displayName),
    );

  return { total: count ?? results.length, results };
}
