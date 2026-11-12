import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { buildCaseExportFileName, buildCaseExportMarkdown } from "@/lib/case-export";
import { getDiagnosticDetail } from "@/lib/services/diagnostics";
import { createClient } from "@/lib/supabase/server";
import { TECHNICAL_ASSET_BUCKET } from "@/lib/technical-assets.mjs";

// Links dos arquivos tecnicos no arquivo exportado: o Claude Code baixa sem login.
const LINK_VALIDITY_DAYS = 7;

// Baixa o caso em Markdown para continuar o diagnostico no Claude Code (plano Pro),
// sem gastar credito de API.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sessão expirada. Entre de novo." }, { status: 401 });
  }

  const { id: diagnosticId } = await params;
  const detail = await getDiagnosticDetail(diagnosticId).catch(() => null);
  if (!detail) {
    return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
  }

  const supabase = await createClient();
  const assetIds = detail.technicalAssets.map((asset) => asset.id);
  const { data: storageRows } = assetIds.length
    ? await supabase.from("technical_assets").select("id, storage_bucket, storage_path").in("id", assetIds)
    : { data: [] };
  const storageById = new Map(
    ((storageRows ?? []) as Array<{ id: string; storage_bucket: string | null; storage_path: string }>).map((row) => [
      row.id,
      row,
    ]),
  );

  const files = await Promise.all(
    detail.technicalAssets.map(async (asset) => {
      const row = storageById.get(asset.id);
      let url: string | null = null;
      if (row?.storage_path) {
        const { data } = await supabase.storage
          .from(row.storage_bucket || TECHNICAL_ASSET_BUCKET)
          .createSignedUrl(row.storage_path, LINK_VALIDITY_DAYS * 24 * 60 * 60, { download: asset.title });
        url = data?.signedUrl ?? null;
      }
      return {
        title: asset.title,
        documentType: asset.documentType,
        association: asset.associationLabel,
        url,
      };
    }),
  );

  const markdown = buildCaseExportMarkdown({
    detail,
    files,
    appUrl: new URL(request.url).origin,
    generatedAt: new Date(),
    linkValidityDays: LINK_VALIDITY_DAYS,
  });
  const fileName = buildCaseExportFileName(detail);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
