import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { authenticateBenchAgent, loadAgentJob } from "@/lib/bench-agent";
import { BIOS_DUMP_BUCKET, biosDumpUploadPath } from "@/lib/services/bios-dumps";

type RouteContext = { params: Promise<{ jobId: string }> };

// Link temporario para o agente enviar o dump direto ao Storage
// (a Vercel limita o corpo das requisicoes a 4,5 MB).
export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateBenchAgent(request);
  if ("error" in auth) return auth.error;
  const { supabase, agentName } = auth;
  const { jobId } = await context.params;

  const job = await loadAgentJob(supabase, jobId, agentName);
  if (!job) {
    return NextResponse.json({ error: "Trabalho nao encontrado para este agente." }, { status: 404 });
  }

  const path = biosDumpUploadPath(job.diagnostic_id, randomUUID());
  const { data, error } = await supabase.storage.from(BIOS_DUMP_BUCKET).createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Falha ao gerar o link." }, { status: 500 });
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl });
}
