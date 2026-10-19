import { syncDiagnosticEmbeddingSource, syncResolvedCaseEmbeddingSource } from "@/lib/services/semantic";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const CLOSURE_CASE_STATUSES = ["confirmed", "probable", "unresolved"] as const;
export const CLOSURE_CAUSE_TYPES = [
  "component_failure",
  "short_circuit",
  "bad_solder",
  "firmware_corruption",
  "line_missing",
  "liquid_damage",
  "thermal_failure",
  "other",
] as const;
export const CLOSURE_SOLUTION_TYPES = [
  "component_replacement",
  "rework",
  "firmware_flash",
  "jumper",
  "cleaning",
  "reballing",
  "configuration_change",
  "other",
] as const;

export type DiagnosticClosureInput = {
  caseStatus: (typeof CLOSURE_CASE_STATUSES)[number];
  resolutionSummary: string;
  repairOutcome: string;
  finalFailureMode?: string | null;
  cause?: { type: string; title: string; explanation: string } | null;
  solution?: { type: string; title: string; procedure: string } | null;
};

export class DiagnosticAlreadyClosedError extends Error {
  constructor() {
    super("Este diagnóstico já foi encerrado.");
  }
}

/**
 * Encerra o caso: status do diagnostico, resolved_cases e, se vierem completas,
 * causa confirmada e solucao aplicada. Usado pelo formulario do painel e pela
 * ferramenta encerrar_diagnostico da IA.
 */
export async function closeDiagnosticCase(
  supabase: SupabaseServerClient,
  diagnosticId: string,
  userId: string,
  input: DiagnosticClosureInput,
) {
  const { data: existing } = await supabase
    .from("resolved_cases")
    .select("id")
    .eq("diagnostic_id", diagnosticId)
    .maybeSingle();

  if (existing) {
    throw new DiagnosticAlreadyClosedError();
  }

  const now = new Date().toISOString();
  const { error: diagnosticError } = await supabase
    .from("diagnostics")
    .update({
      status: input.caseStatus === "unresolved" ? "unresolved" : "resolved",
      completed_at: now,
      current_summary: input.resolutionSummary,
    })
    .eq("id", diagnosticId);

  if (diagnosticError) {
    throw new Error(diagnosticError.message);
  }

  const { data: resolvedCase, error: resolvedError } = await supabase
    .from("resolved_cases")
    .insert({
      diagnostic_id: diagnosticId,
      case_status: input.caseStatus,
      resolution_summary: input.resolutionSummary,
      final_failure_mode: input.finalFailureMode || null,
      repair_outcome: input.repairOutcome,
      reviewed_by_user_id: userId,
      reviewed_at: now,
      knowledge_promoted_at: input.caseStatus === "confirmed" ? now : null,
    })
    .select("id")
    .single();

  if (resolvedError) {
    throw new Error(resolvedError.message);
  }

  let confirmedCauseId: string | null = null;

  if (input.cause?.type && input.cause.title && input.cause.explanation) {
    const { data: cause, error: causeError } = await supabase
      .from("confirmed_causes")
      .insert({
        resolved_case_id: resolvedCase.id,
        cause_type: input.cause.type,
        title: input.cause.title,
        technical_explanation: input.cause.explanation,
        is_primary: true,
      })
      .select("id")
      .single();

    if (causeError) {
      throw new Error(causeError.message);
    }

    confirmedCauseId = cause.id;
  }

  if (input.solution?.type && input.solution.title && input.solution.procedure) {
    const { error: solutionError } = await supabase.from("applied_solutions").insert({
      resolved_case_id: resolvedCase.id,
      confirmed_cause_id: confirmedCauseId,
      solution_type: input.solution.type,
      title: input.solution.title,
      procedure_description: input.solution.procedure,
      was_effective: input.caseStatus !== "unresolved",
      performed_by_user_id: userId,
      performed_at: now,
    });

    if (solutionError) {
      throw new Error(solutionError.message);
    }
  }

  await syncDiagnosticEmbeddingSource(diagnosticId, supabase);
  await syncResolvedCaseEmbeddingSource(diagnosticId, supabase);

  return { resolvedCaseId: resolvedCase.id as string };
}

/**
 * Reabre um caso encerrado (o defeito voltou ou o encerramento estava errado):
 * volta a "ativo" e apaga o fechamento (causa e solucao vao junto, em cascata),
 * para nao ficar como caso resolvido na base de conhecimento.
 */
export async function reopenDiagnosticCase(
  supabase: SupabaseServerClient,
  diagnosticId: string,
  reason: string | null,
) {
  const { data: diagnostic, error: readError } = await supabase
    .from("diagnostics")
    .select("status, current_summary")
    .eq("id", diagnosticId)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }
  if (!diagnostic) {
    throw new Error("Diagnóstico não encontrado.");
  }
  if (diagnostic.status === "active" || diagnostic.status === "waiting_input") {
    return { alreadyOpen: true };
  }

  const { error: deleteError } = await supabase
    .from("resolved_cases")
    .delete()
    .eq("diagnostic_id", diagnosticId);
  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const { error: updateError } = await supabase
    .from("diagnostics")
    .update({
      status: "active",
      completed_at: null,
      current_summary: reason
        ? `Reaberto: ${reason}${diagnostic.current_summary ? `\nAntes: ${diagnostic.current_summary}` : ""}`
        : diagnostic.current_summary,
    })
    .eq("id", diagnosticId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  await syncDiagnosticEmbeddingSource(diagnosticId, supabase);

  return { alreadyOpen: false };
}
