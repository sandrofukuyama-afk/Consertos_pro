import { generateCustomerReportWithClaude } from "@/lib/ai/customer-report-llm";
import {
  isCustomerReport,
  type CustomerReport,
  type CustomerReportLanguage,
} from "@/lib/customer-report";
import { getDiagnosticDetail } from "@/lib/services/diagnostics";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// A conversa entra so como fonte (pecas trocadas, testes finais): corta para
// nao mandar casos longos inteiros.
const MAX_CHAT_MESSAGES = 60;
const MAX_CHARS_PER_MESSAGE = 1500;

export async function getCustomerReportData(supabase: SupabaseServerClient, diagnosticId: string) {
  const { data, error } = await supabase
    .from("diagnostics")
    .select("status, created_at, completed_at, customer_report")
    .eq("id", diagnosticId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }

  return {
    status: data.status as string,
    createdAt: data.created_at as string,
    completedAt: (data.completed_at as string | null) ?? null,
    report: isCustomerReport(data.customer_report) ? (data.customer_report as CustomerReport) : null,
  };
}

export async function generateCustomerReport(
  supabase: SupabaseServerClient,
  diagnosticId: string,
  language: CustomerReportLanguage,
) {
  const detail = await getDiagnosticDetail(diagnosticId);
  const resolved = detail.resolvedCase;

  const facts = {
    equipamento: detail.label,
    fabricante: detail.manufacturer,
    modelo: detail.model,
    relato_inicial: detail.initialReport,
    resumo_atual: detail.summary,
    fechamento: resolved
      ? {
          estado: resolved.caseStatus,
          resumo: resolved.resolutionSummary,
          resultado: resolved.repairOutcome,
          modo_de_falha: resolved.finalFailureMode,
          causa: resolved.cause,
          solucao: resolved.solution,
        }
      : "caso ainda nao encerrado",
    testes: detail.tests.map((test) => ({
      teste: test.testName,
      resultado: test.resultStatus,
      o_que_aconteceu: test.actualResult || test.procedureNotes,
    })),
    medicoes: detail.measurements.slice(0, 30).map((item) => `${item.pointLabel} = ${item.measuredValue}`),
    conversa_do_tecnico: detail.chatMessages
      .slice(-MAX_CHAT_MESSAGES)
      .map((entry) => `${entry.role === "user" ? "Tecnico" : "Assistente"}: ${entry.text.slice(0, MAX_CHARS_PER_MESSAGE)}`),
  };

  const generated = await generateCustomerReportWithClaude(facts, language);
  const report: CustomerReport = {
    ...generated,
    generatedAt: new Date().toISOString(),
    editedAt: null,
  };

  await saveCustomerReport(supabase, diagnosticId, report);
  return report;
}

export async function saveCustomerReport(
  supabase: SupabaseServerClient,
  diagnosticId: string,
  report: CustomerReport,
) {
  const { error } = await supabase
    .from("diagnostics")
    .update({ customer_report: report })
    .eq("id", diagnosticId);

  if (error) {
    throw new Error(error.message);
  }
}
