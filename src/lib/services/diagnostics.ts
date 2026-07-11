import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatRelativeTime } from "@/lib/utils";
import type { DiagnosticDetail, SymptomOption, TestOption } from "@/types/domain";

function pickRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function prettifyStatus(value: string) {
  return value.replaceAll("_", " ");
}

export async function getDiagnosticDetail(diagnosticId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("diagnostics")
    .select(
      `
        id,
        status,
        priority,
        equipment_label,
        current_summary,
        initial_problem_report,
        physical_condition_notes,
        created_at,
        equipment_categories(name),
        manufacturers(name),
        users!diagnostics_opened_by_user_id_fkey(full_name),
        diagnostic_symptoms(
          id,
          severity,
          source_type,
          is_primary,
          captured_at,
          symptoms(name)
        ),
        diagnostic_test_runs(
          id,
          step_order,
          result_status,
          procedure_notes,
          actual_result,
          performed_at,
          tests(name),
          users!diagnostic_test_runs_performed_by_user_id_fkey(full_name)
        ),
        measurements(
          id,
          measurement_type,
          point_label,
          unit,
          measured_value_numeric,
          measured_value_text,
          expected_value_text,
          measured_at,
          users!measurements_measured_by_user_id_fkey(full_name)
        )
      `,
    )
    .eq("id", diagnosticId)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const category = pickRelation(data.equipment_categories);
  const manufacturer = pickRelation(data.manufacturers);
  const openedBy = pickRelation(data.users);

  return {
    id: data.id,
    category: category?.name ?? "Nao classificado",
    manufacturer: manufacturer?.name ?? "Nao identificado",
    label: data.equipment_label ?? "Sem etiqueta",
    status: prettifyStatus(data.status),
    priority: prettifyStatus(data.priority),
    summary: data.current_summary ?? "Resumo ainda nao definido.",
    initialReport: data.initial_problem_report,
    physicalNotes: data.physical_condition_notes ?? "Sem observacoes fisicas.",
    openedBy: openedBy?.full_name ?? "Usuario interno",
    createdAt: formatRelativeTime(data.created_at),
    symptoms: (data.diagnostic_symptoms ?? []).map((item) => {
      const symptom = pickRelation(item.symptoms);

      return {
        id: item.id,
        name: symptom?.name ?? "Sintoma",
        severity: item.severity ?? "nao informada",
        sourceType: prettifyStatus(item.source_type),
        isPrimary: item.is_primary,
        capturedAt: formatRelativeTime(item.captured_at),
      };
    }),
    tests: (data.diagnostic_test_runs ?? []).map((item) => {
      const test = pickRelation(item.tests);
      const tech = pickRelation(item.users);

      return {
        id: item.id,
        testName: test?.name ?? "Teste",
        resultStatus: prettifyStatus(item.result_status),
        stepOrder: item.step_order,
        procedureNotes: item.procedure_notes ?? "Sem procedimento descrito.",
        actualResult: item.actual_result ?? "Sem resultado final registrado.",
        performedAt: formatRelativeTime(item.performed_at),
        technician: tech?.full_name ?? "Tecnico interno",
      };
    }),
    measurements: (data.measurements ?? []).map((item) => {
      const tech = pickRelation(item.users);
      const measuredValue =
        item.measured_value_text ??
        (item.measured_value_numeric !== null && item.measured_value_numeric !== undefined
          ? `${item.measured_value_numeric}${item.unit ? ` ${item.unit}` : ""}`
          : "Sem valor numerico");

      return {
        id: item.id,
        measurementType: prettifyStatus(item.measurement_type),
        pointLabel: item.point_label ?? "Ponto nao informado",
        measuredValue,
        expectedValue: item.expected_value_text ?? "Nao informado",
        measuredAt: formatRelativeTime(item.measured_at),
        technician: tech?.full_name ?? "Tecnico interno",
      };
    }),
  } satisfies DiagnosticDetail;
}

export async function getDiagnosticFormOptions(diagnosticId: string) {
  const supabase = await createClient();

  const { data: diagnostic } = await supabase
    .from("diagnostics")
    .select("equipment_category_id")
    .eq("id", diagnosticId)
    .maybeSingle();

  const [symptomsResult, testsResult] = await Promise.all([
    diagnostic?.equipment_category_id
      ? supabase
          .from("symptoms")
          .select("id, name, symptom_group")
          .eq("equipment_category_id", diagnostic.equipment_category_id)
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] as SymptomOption[] }),
    supabase
      .from("tests")
      .select("id, name, test_group, default_unit")
      .eq("is_active", true)
      .order("name"),
  ]);

  return {
    symptoms: (symptomsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      group: "symptom_group" in item ? item.symptom_group : null,
    })) as SymptomOption[],
    tests: (testsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      group: item.test_group,
      unit: item.default_unit,
    })) as TestOption[],
  };
}
