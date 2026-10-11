import { NextResponse } from "next/server";

import { authenticateBenchAgent } from "@/lib/bench-agent";
import { BIOS_DUMP_BUCKET } from "@/lib/services/bios-dumps";

// Entrega ao agente o proximo trabalho da fila (gravacoes so depois de confirmadas).
export async function GET(request: Request) {
  const auth = await authenticateBenchAgent(request);
  if ("error" in auth) return auth.error;
  const { supabase, agentName } = auth;

  const { data: candidates } = await supabase
    .from("bench_jobs")
    .select("id")
    .eq("status", "pending")
    .or("kind.eq.read,and(kind.eq.write,confirmed_at.not.is.null)")
    .order("created_at", { ascending: true })
    .limit(1);

  const candidate = candidates?.[0];
  if (!candidate) {
    return NextResponse.json({ job: null });
  }

  // So um agente consegue pegar: a condicao status=pending torna a troca atomica.
  const { data: job } = await supabase
    .from("bench_jobs")
    .update({ status: "claimed", agent_name: agentName, claimed_at: new Date().toISOString() })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("id, diagnostic_id, kind, params")
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ job: null });
  }

  const { data: diagnostic } = await supabase
    .from("diagnostics")
    .select("equipment_label")
    .eq("id", job.diagnostic_id)
    .maybeSingle();

  let source: { url: string; sha256: string; fileName: string; sizeBytes: number } | null = null;
  if (job.kind === "write") {
    const params = job.params as { source?: string; source_id?: string };
    const table = params.source === "asset" ? "technical_assets" : "diagnostic_bios_dumps";
    const { data: file } = await supabase
      .from(table)
      .select("storage_path, file_hash_sha256, file_size_bytes, " + (params.source === "asset" ? "original_filename" : "file_name"))
      .eq("id", params.source_id ?? "")
      .maybeSingle();
    const row = file as unknown as {
      storage_path: string;
      file_hash_sha256: string;
      file_size_bytes: number;
      original_filename?: string;
      file_name?: string;
    } | null;
    const signed = row
      ? await supabase.storage.from(BIOS_DUMP_BUCKET).createSignedUrl(row.storage_path, 600)
      : null;

    if (!row || !signed?.data?.signedUrl) {
      await supabase
        .from("bench_jobs")
        .update({ status: "failed", error: "Arquivo a gravar nao encontrado.", finished_at: new Date().toISOString() })
        .eq("id", job.id);
      return NextResponse.json({ job: null });
    }

    source = {
      url: signed.data.signedUrl,
      sha256: row.file_hash_sha256,
      fileName: row.original_filename ?? row.file_name ?? "bios.bin",
      sizeBytes: row.file_size_bytes,
    };
  }

  return NextResponse.json({
    job: {
      id: job.id,
      kind: job.kind,
      diagnosticLabel: diagnostic?.equipment_label ?? null,
      params: job.params,
      source,
    },
  });
}
