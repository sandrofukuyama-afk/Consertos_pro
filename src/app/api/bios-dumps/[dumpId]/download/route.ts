import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ dumpId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Autenticacao necessaria." }, { status: 401 });
  }

  const { dumpId } = await context.params;
  const supabase = await createClient();
  const { data: dump } = await supabase
    .from("diagnostic_bios_dumps")
    .select("file_name, storage_bucket, storage_path")
    .eq("id", dumpId)
    .maybeSingle();

  if (!dump) {
    return NextResponse.json({ error: "Dump nao encontrado." }, { status: 404 });
  }

  // Redireciona para um link temporario do Storage: dumps de 16-32 MB nao
  // passam pelas funcoes da Vercel (limite de tamanho da resposta).
  const { data, error } = await supabase.storage
    .from(dump.storage_bucket)
    .createSignedUrl(dump.storage_path, 300, { download: dump.file_name });
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Falha ao baixar." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
