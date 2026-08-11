import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  const { data: fileStream, error: downloadError } = await supabase.storage
    .from(asset.storage_bucket)
    .download(asset.storage_path);

  if (downloadError || !fileStream) {
    return NextResponse.json(
      { error: downloadError?.message ?? "Falha ao baixar o arquivo tecnico." },
      { status: 500 },
    );
  }

  const bytes = await fileStream.arrayBuffer();

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": asset.mime_type || "application/octet-stream",
      "Content-Disposition": `${shouldDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(asset.original_filename)}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
