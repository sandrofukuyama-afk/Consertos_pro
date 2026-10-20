import type { SupabaseClient } from "@supabase/supabase-js";

import { ASC_BUNDLE_MARKER } from "@/lib/boardview/tebo-asc";
import { TECHNICAL_ASSET_BUCKET } from "@/lib/technical-assets.mjs";

// Ordem em que os arquivos do conjunto ASC entram no texto juntado.
const ASC_FILE_ORDER = ["format", "parts", "pins", "nets", "nails"];

type AscAssetRow = {
  id: string;
  original_filename: string;
  storage_bucket: string | null;
  storage_path: string;
  metadata: Record<string, unknown> | null;
};

function folderOf(asset: AscAssetRow) {
  const origin = String(asset.metadata?.original_path ?? "");
  const cut = Math.max(origin.lastIndexOf("/"), origin.lastIndexOf("\\"), origin.lastIndexOf("!"));
  return cut >= 0 ? origin.slice(0, cut).toLowerCase() : "";
}

function orderOf(fileName: string) {
  const index = ASC_FILE_ORDER.indexOf(fileName.toLowerCase().replace(/\.asc$/, ""));
  return index >= 0 ? index : ASC_FILE_ORDER.length;
}

/**
 * Boardview ASC vem em 5 arquivos (Format/Parts/Pins/Nets/Nails), e cada um vira
 * um item da biblioteca. Ao abrir qualquer um deles, junta os irmaos da mesma
 * pasta de origem num texto so (~1 MB), que o parser tebo-asc entende.
 * Devolve null quando o arquivo nao e .asc.
 */
export async function buildAscBundle(supabase: SupabaseClient, assetId: string): Promise<Uint8Array | null> {
  const { data: asset } = await supabase
    .from("technical_assets")
    .select("id, original_filename, storage_bucket, storage_path, metadata")
    .eq("id", assetId)
    .maybeSingle();

  if (!asset || !String(asset.original_filename).toLowerCase().endsWith(".asc")) {
    return null;
  }

  const folder = folderOf(asset as AscAssetRow);
  const { data: candidates } = await supabase
    .from("technical_assets")
    .select("id, original_filename, storage_bucket, storage_path, metadata")
    .ilike("original_filename", "%.asc");

  const siblings = folder
    ? ((candidates ?? []) as AscAssetRow[]).filter((row) => folderOf(row) === folder)
    : [asset as AscAssetRow];
  if (!siblings.some((row) => row.id === asset.id)) {
    siblings.push(asset as AscAssetRow);
  }
  siblings.sort((left, right) => orderOf(left.original_filename) - orderOf(right.original_filename));

  const chunks: string[] = [];
  for (const row of siblings) {
    const { data } = await supabase.storage
      .from(row.storage_bucket || TECHNICAL_ASSET_BUCKET)
      .download(row.storage_path);
    if (data) {
      const text = new TextDecoder("latin1").decode(await data.arrayBuffer());
      chunks.push(`${ASC_BUNDLE_MARKER} ${row.original_filename}\n${text}`);
    }
  }

  if (!chunks.length) {
    return null;
  }

  // latin1 de volta para bytes: o parser decodifica como latin1.
  const joined = chunks.join("\n");
  const bytes = new Uint8Array(joined.length);
  for (let index = 0; index < joined.length; index += 1) {
    bytes[index] = joined.charCodeAt(index) & 0xff;
  }
  return bytes;
}
