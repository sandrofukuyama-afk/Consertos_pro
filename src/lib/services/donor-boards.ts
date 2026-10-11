import type { SupabaseClient } from "@supabase/supabase-js";

import { locateInPage, normalizePartQuery, type ComponentHit } from "@/lib/donors/locate";
import { extractPdfText } from "@/lib/pdf-text";

export const DONOR_PHOTO_BUCKET = "technical-assets";

type SchematicAsset = { id: string; original_filename: string; storage_bucket: string; storage_path: string };

function normalizeCode(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Procura a placa/modelo do catalogo que corresponde ao codigo lido na foto. */
export async function matchBoardCode(supabase: SupabaseClient, boardCode: string | null) {
  const code = normalizeCode(boardCode ?? "");
  if (code.length < 4) return { boardId: null, modelId: null };

  const { data: boards } = await supabase.from("boards").select("id, board_code");
  const board = (boards ?? []).find((row) => {
    const candidate = normalizeCode(row.board_code ?? "");
    return candidate.length >= 4 && (candidate === code || code.includes(candidate) || candidate.includes(code));
  });
  if (!board) return { boardId: null, modelId: null };

  const { data: link } = await supabase
    .from("model_boards")
    .select("equipment_model_id")
    .eq("board_id", board.id)
    .limit(1)
    .maybeSingle();

  return { boardId: board.id as string, modelId: (link?.equipment_model_id as string | undefined) ?? null };
}

/** Esquemas PDF ligados a placa ou ao modelo da doadora. */
async function schematicsFor(supabase: SupabaseClient, boardId: string | null, modelId: string | null) {
  const filters = [boardId ? `board_id.eq.${boardId}` : null, modelId ? `equipment_model_id.eq.${modelId}` : null].filter(
    Boolean,
  );
  if (!filters.length) return [] as SchematicAsset[];

  const { data } = await supabase
    .from("technical_assets")
    .select("id, original_filename, storage_bucket, storage_path")
    .eq("asset_type", "schematic_pdf")
    .eq("file_format", "pdf")
    .or(filters.join(","));
  return (data ?? []) as SchematicAsset[];
}

/** Extrai e guarda o texto de cada pagina do esquema (uma vez por esquema). */
async function indexSchematic(supabase: SupabaseClient, asset: SchematicAsset) {
  const { count } = await supabase
    .from("schematic_page_texts")
    .select("page", { count: "exact", head: true })
    .eq("technical_asset_id", asset.id);
  if (count) return count;

  const download = await supabase.storage.from(asset.storage_bucket).download(asset.storage_path);
  if (download.error || !download.data) throw new Error(`Falha ao baixar ${asset.original_filename}.`);

  const { pages } = await extractPdfText(new Uint8Array(await download.data.arrayBuffer()));
  const rows = pages
    .filter((page) => page.text.trim())
    .map((page) => ({ technical_asset_id: asset.id, page: page.num, content: page.text }));

  for (let start = 0; start < rows.length; start += 50) {
    const { error } = await supabase.from("schematic_page_texts").insert(rows.slice(start, start + 50));
    if (error) throw new Error(error.message);
  }
  return rows.length;
}

/** Indexa os esquemas da doadora e atualiza o status. */
export async function indexDonorBoard(supabase: SupabaseClient, donorId: string) {
  const { data: donor } = await supabase
    .from("donor_boards")
    .select("id, board_id, equipment_model_id")
    .eq("id", donorId)
    .single();
  if (!donor) throw new Error("Doadora nao encontrada.");

  const assets = await schematicsFor(supabase, donor.board_id, donor.equipment_model_id);
  if (!assets.length) {
    await supabase
      .from("donor_boards")
      .update({ index_status: "sem_esquema", index_detail: "Sem esquema na biblioteca: a busca usa só o que foi lido na foto." })
      .eq("id", donorId);
    return { status: "sem_esquema" as const, pages: 0 };
  }

  try {
    let pages = 0;
    for (const asset of assets) pages += await indexSchematic(supabase, asset);
    await supabase
      .from("donor_boards")
      .update({ index_status: "indexada", index_detail: `${assets.length} esquema(s), ${pages} página(s)` })
      .eq("id", donorId);
    return { status: "indexada" as const, pages };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao indexar.";
    await supabase.from("donor_boards").update({ index_status: "erro", index_detail: message }).eq("id", donorId);
    return { status: "erro" as const, pages: 0 };
  }
}

export type DonorSearchResult = {
  donorId: string;
  code: string;
  title: string;
  hits: Array<
    ComponentHit & {
      page: number | null;
      source: "esquema" | "foto";
      schematicHref: string | null;
      boardviewHref: string | null;
    }
  >;
};

/** Em quais doadoras existe a peca, e onde (referencia, pagina, boardview). */
export async function searchDonorComponents(supabase: SupabaseClient, query: string): Promise<DonorSearchResult[]> {
  const tokens = normalizePartQuery(query);
  if (!tokens.length) return [];

  const { data: donors } = await supabase
    .from("donor_boards")
    .select("id, code, title, board_code_text, board_id, equipment_model_id");
  if (!donors?.length) return [];

  // Esquemas de cada doadora (pela placa ou pelo modelo).
  const boardIds = donors.map((donor) => donor.board_id).filter(Boolean);
  const modelIds = donors.map((donor) => donor.equipment_model_id).filter(Boolean);
  const assetFilters = [
    boardIds.length ? `board_id.in.(${boardIds.join(",")})` : null,
    modelIds.length ? `equipment_model_id.in.(${modelIds.join(",")})` : null,
  ].filter(Boolean);
  const { data: assets } = assetFilters.length
    ? await supabase
        .from("technical_assets")
        .select("id, file_format, asset_type, board_id, equipment_model_id")
        .or(assetFilters.join(","))
    : { data: [] as Array<{ id: string; file_format: string; asset_type: string; board_id: string | null; equipment_model_id: string | null }> };

  const schematicIds = (assets ?? []).filter((asset) => asset.file_format === "pdf").map((asset) => asset.id);

  let pageQuery = supabase.from("schematic_page_texts").select("technical_asset_id, page, content");
  if (schematicIds.length) pageQuery = pageQuery.in("technical_asset_id", schematicIds);
  for (const token of tokens) pageQuery = pageQuery.ilike("content", `%${token}%`);
  const [{ data: pages }, { data: photos }] = await Promise.all([
    schematicIds.length ? pageQuery.limit(300) : Promise.resolve({ data: [] as Array<{ technical_asset_id: string; page: number; content: string }> }),
    (() => {
      let photoQuery = supabase.from("donor_board_index").select("donor_board_id, content").eq("source", "foto");
      for (const token of tokens) photoQuery = photoQuery.ilike("content", `%${token}%`);
      return photoQuery.limit(100);
    })(),
  ]);

  const results = new Map<string, DonorSearchResult>();
  const resultFor = (donor: (typeof donors)[number]) => {
    if (!results.has(donor.id)) {
      results.set(donor.id, {
        donorId: donor.id,
        code: donor.code,
        title: donor.title ?? donor.board_code_text ?? "Placa sem identificação",
        hits: [],
      });
    }
    return results.get(donor.id)!;
  };

  for (const page of pages ?? []) {
    const asset = assets?.find((item) => item.id === page.technical_asset_id);
    if (!asset) continue;
    const owners = donors.filter(
      (donor) =>
        (donor.board_id && donor.board_id === asset.board_id) ||
        (donor.equipment_model_id && donor.equipment_model_id === asset.equipment_model_id),
    );
    const located = locateInPage(page.content, tokens);
    for (const donor of owners) {
      const boardview = assets?.find(
        (item) =>
          (item.file_format === "brd" || item.file_format === "bdv") &&
          ((donor.board_id && item.board_id === donor.board_id) ||
            (donor.equipment_model_id && item.equipment_model_id === donor.equipment_model_id)),
      );
      for (const hit of located.length ? located : [{ refdes: null, part: tokens.join(" ") }]) {
        resultFor(donor).hits.push({
          ...hit,
          page: page.page,
          source: "esquema",
          schematicHref: `/boardview/lab?schematic_asset_id=${asset.id}&page=${page.page}`,
          boardviewHref:
            boardview && hit.refdes
              ? `/boardview/lab?boardview_asset_id=${boardview.id}&component=${encodeURIComponent(hit.refdes)}`
              : null,
        });
      }
    }
  }

  for (const photo of photos ?? []) {
    const donor = donors.find((item) => item.id === photo.donor_board_id);
    if (!donor) continue;
    resultFor(donor).hits.push({
      refdes: null,
      part:
        String(photo.content)
          .split("\n")
          .find((line: string) => tokens.every((token) => line.toUpperCase().includes(token))) ?? tokens.join(" "),
      page: null,
      source: "foto",
      schematicHref: null,
      boardviewHref: null,
    });
  }

  // A mesma placa pode ter mais de um PDF de esquema: mostra cada posicao uma vez.
  for (const result of results.values()) {
    const seen = new Set<string>();
    result.hits = result.hits.filter((hit) => {
      const key = hit.refdes ? `${hit.refdes}|${hit.part}` : `${hit.source}|${hit.page}|${hit.part}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return [...results.values()]
    .map((result) => ({ ...result, hits: result.hits.sort((a, b) => Number(!a.refdes) - Number(!b.refdes)) }))
    .sort((a, b) => b.hits.filter((hit) => hit.refdes).length - a.hits.filter((hit) => hit.refdes).length);
}
