import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Autentica o agente de bancada pelo token (BENCH_AGENT_TOKEN) e registra o
 * contato. O agente nunca recebe a chave do banco: so fala com esta API.
 */
export async function authenticateBenchAgent(request: Request) {
  // trim: valor colado na Vercel ou no bench-agent.env costuma vir com espaco/quebra de linha.
  const expected = (process.env.BENCH_AGENT_TOKEN ?? "").trim();
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const agentName = (request.headers.get("x-agent-name") ?? "bancada").slice(0, 60);

  const valid =
    expected.length >= 24 &&
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));

  if (!valid) {
    // Diz so o tipo do problema (nunca o valor) para o tecnico saber onde corrigir.
    const reason =
      expected.length < 24
        ? "BENCH_AGENT_TOKEN nao esta configurado na Vercel (ou tem menos de 24 caracteres). Configure e faca Redeploy."
        : provided.length === 0
          ? "O agente nao enviou token: preencha BENCH_AGENT_TOKEN no bench-agent.env."
          : `Token diferente do configurado na Vercel (agente: ${provided.length} caracteres, app: ${expected.length}).`;
    return { error: NextResponse.json({ error: `Agente nao autorizado: ${reason}` }, { status: 401 }) } as const;
  }

  const supabase = createSupabaseAdminClient();
  await supabase
    .from("bench_agents")
    .upsert({ name: agentName, last_seen_at: new Date().toISOString(), info: { versao: request.headers.get("x-agent-version") } });

  return { supabase, agentName } as const;
}

/** Garante que o trabalho existe e foi pego por este agente. */
export async function loadAgentJob(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  jobId: string,
  agentName: string,
) {
  const { data: job } = await supabase
    .from("bench_jobs")
    .select("id, diagnostic_id, kind, status, params, agent_name")
    .eq("id", jobId)
    .maybeSingle();

  if (!job || job.agent_name !== agentName || !["claimed", "running"].includes(job.status)) {
    return null;
  }

  return job;
}
