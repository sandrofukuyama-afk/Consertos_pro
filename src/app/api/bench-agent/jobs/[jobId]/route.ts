import { NextResponse } from "next/server";

import { authenticateBenchAgent, loadAgentJob } from "@/lib/bench-agent";

type RouteContext = { params: Promise<{ jobId: string }> };

// Andamento e resultado de um trabalho: { status?, progress?, error?, result? }.
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
    status?: string;
    progress?: string;
    error?: string;
    result?: Record<string, unknown>;
  };
  const status = ["running", "done", "failed"].includes(body.status ?? "") ? body.status : undefined;

  const { error } = await supabase
    .from("bench_jobs")
    .update({
      ...(status ? { status } : {}),
      ...(body.progress !== undefined ? { progress: String(body.progress).slice(0, 300) } : {}),
      ...(body.error !== undefined ? { error: String(body.error).slice(0, 2000) } : {}),
      ...(body.result ? { result: body.result } : {}),
      ...(status === "done" || status === "failed" ? { finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", jobId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
