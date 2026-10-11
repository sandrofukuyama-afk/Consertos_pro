import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { analyzeBiosDump } from "@/lib/bios/analyze";

export const BIOS_DUMP_BUCKET = "technical-assets";
export const BIOS_DUMP_MAX_BYTES = 64 * 1024 * 1024;

export type BiosDumpKind = "original" | "lido" | "backup" | "gravado" | "verificado" | "enviado";

export function biosDumpUploadPath(diagnosticId: string, token: string) {
  return `dumps/${diagnosticId}/tmp-${token}.bin`;
}

/**
 * Registra um dump que ja esta no Storage (enviado por link assinado): confere o
 * hash, analisa, compara com a biblioteca e move para o caminho definitivo.
 */
export async function registerUploadedBiosDump(
  supabase: SupabaseClient,
  input: {
    diagnosticId: string;
    tempPath: string;
    fileName: string;
    kind: BiosDumpKind;
    source: "upload" | "agente";
    expectedSha256?: string | null;
    chipName?: string | null;
    programmer?: string | null;
    benchJobId?: string | null;
    userId?: string | null;
    notes?: string | null;
  },
) {
  const download = await supabase.storage.from(BIOS_DUMP_BUCKET).download(input.tempPath);
  if (download.error || !download.data) {
    throw new Error(`Dump nao encontrado no armazenamento: ${download.error?.message ?? "vazio"}`);
  }

  const bytes = new Uint8Array(await download.data.arrayBuffer());
  if (!bytes.length || bytes.length > BIOS_DUMP_MAX_BYTES) {
    throw new Error("Dump vazio ou maior que 64 MB.");
  }

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (input.expectedSha256 && input.expectedSha256 !== sha256) {
    throw new Error("O arquivo chegou diferente do enviado (hash nao confere). Envie de novo.");
  }

  const finalPath = `dumps/${input.diagnosticId}/${sha256}.bin`;
  if (finalPath !== input.tempPath) {
    const moved = await supabase.storage.from(BIOS_DUMP_BUCKET).move(input.tempPath, finalPath);
    if (moved.error) {
      if (!/exists|duplicate/i.test(moved.error.message)) {
        throw new Error(`Falha ao guardar o dump: ${moved.error.message}`);
      }
      // Mesmo conteudo ja salvo neste caso: descarta a copia temporaria.
      await supabase.storage.from(BIOS_DUMP_BUCKET).remove([input.tempPath]);
    }
  }

  const analysis = analyzeBiosDump(bytes);

  // Igual a algum arquivo da biblioteca ou a outro dump ja lido?
  const [{ data: libraryMatch }, { data: dumpMatch }] = await Promise.all([
    supabase
      .from("technical_assets")
      .select("id, original_filename, metadata")
      .eq("file_hash_sha256", sha256)
      .limit(1),
    supabase
      .from("diagnostic_bios_dumps")
      .select("id, diagnostic_id, kind, created_at")
      .eq("file_hash_sha256", sha256)
      .limit(3),
  ]);
  const library = libraryMatch?.[0] ?? null;
  const comparison = {
    biblioteca: library
      ? {
          id: library.id,
          nome:
            typeof (library.metadata as Record<string, unknown> | null)?.display_name === "string"
              ? (library.metadata as Record<string, string>).display_name
              : library.original_filename,
        }
      : null,
    outros_dumps: (dumpMatch ?? []).map((row) => ({ id: row.id, caso: row.diagnostic_id, tipo: row.kind })),
  };

  const { data: row, error } = await supabase
    .from("diagnostic_bios_dumps")
    .insert({
      diagnostic_id: input.diagnosticId,
      kind: input.kind,
      file_name: input.fileName,
      storage_bucket: BIOS_DUMP_BUCKET,
      storage_path: finalPath,
      file_size_bytes: bytes.length,
      file_hash_sha256: sha256,
      chip_name: input.chipName ?? null,
      programmer: input.programmer ?? null,
      source: input.source,
      analysis: { ...analysis, comparacao: comparison },
      notes: input.notes ?? null,
      bench_job_id: input.benchJobId ?? null,
      created_by_user_id: input.userId ?? null,
    })
    .select("id, file_hash_sha256")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { id: row.id as string, sha256, analysis, comparison };
}

export type DiagnosticBiosData = {
  dumps: Array<{
    id: string;
    kind: BiosDumpKind;
    fileName: string;
    sizeBytes: number;
    sha256: string;
    chipName: string | null;
    source: "upload" | "agente";
    createdAt: string;
    summary: string;
    warnings: string[];
    libraryMatch: string | null;
  }>;
  jobs: Array<{
    id: string;
    kind: "read" | "write";
    status: string;
    progress: string | null;
    error: string | null;
    createdAt: string;
    finishedAt: string | null;
  }>;
  agentOnline: { name: string; lastSeenAt: string } | null;
  libraryBios: Array<{ id: string; name: string; fileName: string; sizeBytes: number }>;
};

/** Dados da secao BIOS do caso. Usa o cliente do usuario (RLS). */
export async function getDiagnosticBiosData(
  supabase: SupabaseClient,
  diagnosticId: string,
  context: { modelId: string | null; boardIds: string[] },
): Promise<DiagnosticBiosData> {
  const since = new Date(Date.now() - 30_000).toISOString();
  const libraryFilters = [
    context.modelId ? `equipment_model_id.eq.${context.modelId}` : null,
    context.boardIds.length ? `board_id.in.(${context.boardIds.join(",")})` : null,
  ].filter(Boolean);

  const [dumps, jobs, agents, library] = await Promise.all([
    supabase
      .from("diagnostic_bios_dumps")
      .select("id, kind, file_name, file_size_bytes, file_hash_sha256, chip_name, source, created_at, analysis")
      .eq("diagnostic_id", diagnosticId)
      .order("created_at", { ascending: false }),
    supabase
      .from("bench_jobs")
      .select("id, kind, status, progress, error, created_at, finished_at")
      .eq("diagnostic_id", diagnosticId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("bench_agents")
      .select("name, last_seen_at")
      .gte("last_seen_at", since)
      .order("last_seen_at", { ascending: false })
      .limit(1),
    libraryFilters.length
      ? supabase
          .from("technical_assets")
          .select("id, original_filename, file_size_bytes, metadata")
          .in("asset_type", ["bios", "firmware"])
          .or(libraryFilters.join(","))
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return {
    dumps: (dumps.data ?? []).map((row) => {
      const analysis = (row.analysis ?? {}) as {
        summary?: string;
        warnings?: string[];
        comparacao?: { biblioteca?: { nome?: string } | null };
      };
      return {
        id: row.id,
        kind: row.kind,
        fileName: row.file_name,
        sizeBytes: row.file_size_bytes,
        sha256: row.file_hash_sha256,
        chipName: row.chip_name,
        source: row.source,
        createdAt: row.created_at,
        summary: analysis.summary ?? "",
        warnings: analysis.warnings ?? [],
        libraryMatch: analysis.comparacao?.biblioteca?.nome ?? null,
      };
    }),
    jobs: (jobs.data ?? []).map((row) => ({
      id: row.id,
      kind: row.kind,
      status: row.status,
      progress: row.progress,
      error: row.error,
      createdAt: row.created_at,
      finishedAt: row.finished_at,
    })),
    agentOnline: agents.data?.[0] ? { name: agents.data[0].name, lastSeenAt: agents.data[0].last_seen_at } : null,
    libraryBios: ((library.data ?? []) as Array<{
      id: string;
      original_filename: string;
      file_size_bytes: number;
      metadata: Record<string, unknown> | null;
    }>).map((row) => ({
      id: row.id,
      name: typeof row.metadata?.display_name === "string" ? row.metadata.display_name : row.original_filename,
      fileName: row.original_filename,
      sizeBytes: row.file_size_bytes,
    })),
  };
}
