"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Conta criada. Agora faca login.");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createDiagnosticAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const categoryId = String(formData.get("equipment_category_id") ?? "");
  const manufacturerId =
    String(formData.get("manufacturer_id") ?? "").trim() || null;
  const equipmentLabel = String(formData.get("equipment_label") ?? "").trim();
  const problemReport = String(formData.get("initial_problem_report") ?? "").trim();
  const physicalNotes =
    String(formData.get("physical_condition_notes") ?? "").trim() || null;

  if (!categoryId || !problemReport) {
    redirect(
      "/diagnosticos/novo?error=Categoria e relato inicial sao obrigatorios.",
    );
  }

  const { data, error } = await supabase
    .from("diagnostics")
    .insert({
      equipment_category_id: categoryId,
      manufacturer_id: manufacturerId,
      opened_by_user_id: user.id,
      status: "active",
      priority: "normal",
      equipment_label: equipmentLabel || null,
      initial_problem_report: problemReport,
      physical_condition_notes: physicalNotes,
      current_summary: problemReport,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/diagnosticos/novo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  redirect(`/diagnosticos/${data.id}?message=Diagnostico criado com sucesso.`);
}

export async function addDiagnosticSymptomAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const symptomId = String(formData.get("symptom_id") ?? "");
  const severity = String(formData.get("severity") ?? "").trim() || null;
  const sourceType = String(formData.get("source_type") ?? "technician");
  const isPrimary = formData.get("is_primary") === "on";

  if (!diagnosticId || !symptomId) {
    redirect(`/diagnosticos/${diagnosticId}?error=Sintoma invalido.`);
  }

  const { error } = await supabase.from("diagnostic_symptoms").insert({
    diagnostic_id: diagnosticId,
    symptom_id: symptomId,
    severity,
    source_type: sourceType,
    is_primary: isPrimary,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Sintoma registrado.`);
}

export async function addDiagnosticTestAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const testId = String(formData.get("test_id") ?? "");
  const procedureNotes =
    String(formData.get("procedure_notes") ?? "").trim() || null;
  const actualResult = String(formData.get("actual_result") ?? "").trim() || null;
  const resultStatus = String(formData.get("result_status") ?? "pending");

  if (!diagnosticId || !testId) {
    redirect(`/diagnosticos/${diagnosticId}?error=Teste invalido.`);
  }

  const { data: currentRuns } = await supabase
    .from("diagnostic_test_runs")
    .select("step_order")
    .eq("diagnostic_id", diagnosticId)
    .order("step_order", { ascending: false })
    .limit(1);

  const nextStep = (currentRuns?.[0]?.step_order ?? 0) + 1;

  const { error } = await supabase.from("diagnostic_test_runs").insert({
    diagnostic_id: diagnosticId,
    test_id: testId,
    performed_by_user_id: user.id,
    step_order: nextStep,
    result_status: resultStatus,
    procedure_notes: procedureNotes,
    actual_result: actualResult,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Teste registrado.`);
}

export async function addMeasurementAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const measurementType = String(formData.get("measurement_type") ?? "");
  const pointLabel = String(formData.get("point_label") ?? "").trim() || null;
  const unit = String(formData.get("unit") ?? "").trim() || null;
  const measuredValueText =
    String(formData.get("measured_value_text") ?? "").trim() || null;
  const expectedValueText =
    String(formData.get("expected_value_text") ?? "").trim() || null;
  const measuredValueNumericRaw = String(
    formData.get("measured_value_numeric") ?? "",
  ).trim();
  const measuredValueNumeric = measuredValueNumericRaw
    ? Number(measuredValueNumericRaw)
    : null;

  if (!diagnosticId || !measurementType) {
    redirect(`/diagnosticos/${diagnosticId}?error=Medicao invalida.`);
  }

  const { error } = await supabase.from("measurements").insert({
    diagnostic_id: diagnosticId,
    measurement_type: measurementType,
    point_label: pointLabel,
    unit,
    measured_value_numeric:
      measuredValueNumeric !== null && !Number.isNaN(measuredValueNumeric)
        ? measuredValueNumeric
        : null,
    measured_value_text: measuredValueText,
    expected_value_text: expectedValueText,
    measured_by_user_id: user.id,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Medicao registrada.`);
}
