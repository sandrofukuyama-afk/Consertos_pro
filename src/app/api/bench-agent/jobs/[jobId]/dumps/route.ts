import { NextResponse } from "next/server";

import { authenticateBenchAgent, loadAgentJob } from "@/lib/bench-agent";
import { registerUploadedBiosDump, type BiosDumpKind } from "@/lib/services/bios-dumps";

type RouteContext = { params: Promise<{ jobId: string }> };

// Analisar dumps de 32 MB leva alguns segundos.
export const maxDuration = 60;

// "leitura" vira "original" se for o primeiro dump do caso, senao "lido".
const AGENT_KINDS = ["leitura", "backup", "verificado"] as const;

// Registra no caso um dump que o agente acabou de enviar ao Storage.
export async function POST(request: Request, context: RouteContext) {
  const auth = await authenticateBenchAgent(request);
  if ("error" in auth) return auth.error;
  const { supabase, agentName } = auth;
  const { jobId } = await context.params;

  const job = await loadAgentJob(supabase, jobId, agentName);
  if (!job) {
    return NextResponse.json({ error: "Trabalho nao encontrado para este agente." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    path?: string;
    fileName?: string;
    kind?: (typeof AGENT_KINDS)[number];
    sha256?: string;
    chip?: string;
    programmer?: string;
  };

  if (!body.path?.startsWith(`dumps/${job.diagnostic_id}/tmp-`) || !AGENT_KINDS.includes(body.kind!)) {
    return NextResponse.json({ error: "Dados do dump invalidos." }, { status: 400 });
  }

  let kind: BiosDumpKind = body.kind === "leitura" ? "lido" : body.kind!;
  if (body.kind === "leitura") {
    const { count } = await supabase
      .from("diagnostic_bios_dumps")
      .select("id", { count: "exact", head: true })
      .eq("diagnostic_id", job.diagnostic_id);
    kind = count ? "lido" : "original";
  }

  try {
    const { data: job2 } = await supabase.from("bench_jobs").select("requested_by_user_id").eq("id", jobId).single();
    const saved = await registerUploadedBiosDump(supabase, {
      diagnosticId: job.diagnostic_id,
      tempPath: body.path,
      fileName: body.fileName ?? `${kind}.bin`,
      kind,
      source: "agente",
      expectedSha256: body.sha256 ?? null,
      chipName: body.chip ?? null,
      programmer: body.programmer ?? agentName,
      benchJobId: jobId,
      userId: job2?.requested_by_user_id ?? null,
    });
    return NextResponse.json({ dumpId: saved.id, summary: saved.analysis.summary, warnings: saved.analysis.warnings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha." }, { status: 400 });
  }
}
