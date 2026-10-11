"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import {
  BIOS_DUMP_BUCKET,
  biosDumpUploadPath,
  registerUploadedBiosDump,
  type BiosDumpKind,
} from "@/lib/services/bios-dumps";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function backToBios(diagnosticId: string, params?: Record<string, string>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  redirect(`/diagnosticos/${diagnosticId}${query}#bios`);
}

export async function requestBiosReadAction(formData: FormData) {
  const user = await requireCurrentUser();
  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.from("bench_jobs").insert({
    diagnostic_id: diagnosticId,
    kind: "read",
    requested_by_user_id: user.id,
  });

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  backToBios(diagnosticId, error ? { error: error.message } : { message: "Leitura pedida ao agente da bancada." });
}

export async function requestBiosWriteAction(formData: FormData) {
  const user = await requireCurrentUser();
  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const [source, sourceId] = String(formData.get("source") ?? "").split(":");
  const confirmed = formData.get("confirm") === "on";

  if (!confirmed) {
    backToBios(diagnosticId, { error: "Marque a confirmação antes de gravar." });
  }
  if ((source !== "dump" && source !== "asset") || !sourceId) {
    backToBios(diagnosticId, { error: "Escolha o arquivo a gravar." });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("bench_jobs").insert({
    diagnostic_id: diagnosticId,
    kind: "write",
    params: { source, source_id: sourceId },
    requested_by_user_id: user.id,
    confirmed_at: new Date().toISOString(),
  });

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  backToBios(
    diagnosticId,
    error
      ? { error: error.message }
      : { message: "Gravação enviada ao agente: ele lê um backup, grava e verifica." },
  );
}

export async function cancelBenchJobAction(formData: FormData) {
  await requireCurrentUser();
  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const jobId = String(formData.get("job_id") ?? "");
  const supabase = await createClient();

  // So cancela o que o agente ainda nao pegou.
  await supabase
    .from("bench_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("status", "pending");

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  backToBios(diagnosticId);
}

/** Link para o navegador enviar o dump direto ao Storage (sem o limite de 4,5 MB). */
export async function createBiosUploadUrlAction(diagnosticId: string) {
  await requireCurrentUser();
  const path = biosDumpUploadPath(diagnosticId, randomUUID());
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(BIOS_DUMP_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(error?.message ?? "Falha ao preparar o envio.");
  }
  return { path, token: data.token };
}

export async function registerBiosUploadAction(input: {
  diagnosticId: string;
  path: string;
  fileName: string;
  kind: BiosDumpKind;
}) {
  const user = await requireCurrentUser();

  if (!input.path.startsWith(`dumps/${input.diagnosticId}/tmp-`)) {
    throw new Error("Envio invalido.");
  }

  const saved = await registerUploadedBiosDump(createSupabaseAdminClient(), {
    diagnosticId: input.diagnosticId,
    tempPath: input.path,
    fileName: input.fileName,
    kind: input.kind === "original" ? "original" : "enviado",
    source: "upload",
    userId: user.id,
  });

  revalidatePath(`/diagnosticos/${input.diagnosticId}`);
  return { summary: saved.analysis.summary, warnings: saved.analysis.warnings };
}
