import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TECHNICAL_ASSET_BUCKET } from "@/lib/technical-assets.mjs";

type RouteContext = {
  params: Promise<{
    assetId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const { assetId } = await context.params;
  const normalizedAssetId = assetId.trim();
  const shouldDownload = new URL(request.url).searchParams.get("download") === "1";

  if (!normalizedAssetId) {
    return NextResponse.json({ error: "Asset invalido." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: asset, error: assetError } = await supabase
    .from("technical_assets")
    .select("id, original_filename, storage_bucket, storage_path, mime_type")
    .eq("id", normalizedAssetId)
    .maybeSingle();

  if (assetError) {
    return NextResponse.json({ error: assetError.message }, { status: 500 });
  }

  if (!asset) {
    return NextResponse.json({ error: "Arquivo tecnico nao encontrado." }, { status: 404 });
  }

  const candidateBuckets = Array.from(
    new Set(
      [asset.storage_bucket, TECHNICAL_ASSET_BUCKET, "technical-documents"].filter(
        (value): value is string => Boolean(value?.trim()),
      ),
    ),
  );
  let fileStream: Blob | null = null;
  const downloadErrors: string[] = [];

  for (const bucket of candidateBuckets) {
    const { data, error } = await supabase.storage.from(bucket).download(asset.storage_path);
    if (data) {
      fileStream = data;
      if (bucket !== asset.storage_bucket) {
        console.warn(
          `[technical-assets] fallback bucket used for ${asset.id}: expected=${asset.storage_bucket} actual=${bucket}`,
        );
      }
      break;
    }

    if (error?.message) {
      downloadErrors.push(`${bucket}: ${error.message}`);
    }
  }

  if (!fileStream) {
    return NextResponse.json(
      {
        error:
          downloadErrors[0] ??
          "Falha ao baixar o arquivo tecnico salvo no Storage.",
      },
      { status: 500 },
    );
  }

  const bytes = await fileStream.arrayBuffer();

  if (bytes.byteLength <= 0) {
    return NextResponse.json(
      { error: "O arquivo tecnico baixado do Storage esta vazio." },
      { status: 500 },
    );
  }

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": asset.mime_type || "application/octet-stream",
      "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(asset.original_filename)}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
