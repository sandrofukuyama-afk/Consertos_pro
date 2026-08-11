import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const { assetId } = await context.params;
  const normalizedAssetId = assetId.trim();

  if (!normalizedAssetId) {
    return NextResponse.json({ error: "Asset invalido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: asset, error: assetError } = await supabase
    .from("technical_assets")
    .select(`
      id,
      original_filename,
      storage_bucket,
      storage_path,
      file_hash_sha256,
      technical_asset_links(id)
    `)
    .eq("id", normalizedAssetId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json({ error: "Arquivo tecnico nao encontrado." }, { status: 404 });
  }

  const { count: duplicateCount, error: duplicateError } = await supabase
    .from("technical_assets")
    .select("id", { count: "exact", head: true })
    .eq("file_hash_sha256", asset.file_hash_sha256)
    .neq("id", normalizedAssetId);

  if (duplicateError) {
    return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  }

  const { error: deleteAssetError } = await supabase
    .from("technical_assets")
    .delete()
    .eq("id", normalizedAssetId);

  if (deleteAssetError) {
    return NextResponse.json({ error: deleteAssetError.message }, { status: 500 });
  }

  let storageRemoved = false;
  let storageWarning: string | null = null;

  if (!duplicateCount) {
    const { error: storageDeleteError } = await supabase.storage
      .from(asset.storage_bucket)
      .remove([asset.storage_path]);

    if (storageDeleteError) {
      storageWarning =
        "O registro foi removido da biblioteca, mas o arquivo fisico no Storage precisa ser revisado manualmente.";
    } else {
      storageRemoved = true;
    }
  }

  return NextResponse.json({
    deleted: true,
    storageRemoved,
    linkedContexts: Array.isArray(asset.technical_asset_links)
      ? asset.technical_asset_links.length
      : 0,
    warning: storageWarning,
    message: storageWarning
      ? storageWarning
      : "Arquivo tecnico removido da biblioteca com sucesso.",
  });
}
