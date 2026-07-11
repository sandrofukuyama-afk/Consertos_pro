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

export async function addHypothesisAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const evidenceSummary =
    String(formData.get("evidence_summary") ?? "").trim() || null;
  const confidenceRaw = String(formData.get("confidence_score") ?? "").trim();
  const confidenceScore = confidenceRaw ? Number(confidenceRaw) : null;

  if (!diagnosticId || !title) {
    redirect(`/diagnosticos/${diagnosticId}?error=Hipotese invalida.`);
  }

  const { error } = await supabase.from("hypotheses").insert({
    diagnostic_id: diagnosticId,
    title,
    description,
    evidence_summary: evidenceSummary,
    confidence_score:
      confidenceScore !== null && !Number.isNaN(confidenceScore)
        ? confidenceScore
        : null,
    status: "open",
    created_by_type: "technician",
    created_by_user_id: user.id,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  redirect(`/diagnosticos/${diagnosticId}?message=Hipotese registrada.`);
}

export async function uploadAttachmentAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const attachmentType = String(formData.get("attachment_type") ?? "report");
  const file = formData.get("file");

  if (!diagnosticId || !title || !(file instanceof File) || file.size === 0) {
    redirect(`/diagnosticos/${diagnosticId}?error=Anexo invalido.`);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${diagnosticId}/${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("diagnostic-attachments")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error } = await supabase.from("attachments").insert({
    diagnostic_id: diagnosticId,
    attachment_type: attachmentType,
    title,
    description,
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: file.size,
    uploaded_by_user_id: user.id,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  redirect(`/diagnosticos/${diagnosticId}?message=Anexo enviado.`);
}

export async function closeDiagnosticAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const caseStatus = String(formData.get("case_status") ?? "");
  const resolutionSummary = String(formData.get("resolution_summary") ?? "").trim();
  const repairOutcome = String(formData.get("repair_outcome") ?? "").trim();
  const finalFailureMode =
    String(formData.get("final_failure_mode") ?? "").trim() || null;
  const causeType = String(formData.get("cause_type") ?? "").trim() || null;
  const causeTitle = String(formData.get("cause_title") ?? "").trim() || null;
  const technicalExplanation =
    String(formData.get("technical_explanation") ?? "").trim() || null;
  const solutionType =
    String(formData.get("solution_type") ?? "").trim() || null;
  const solutionTitle =
    String(formData.get("solution_title") ?? "").trim() || null;
  const procedureDescription =
    String(formData.get("procedure_description") ?? "").trim() || null;

  if (!diagnosticId || !caseStatus || !resolutionSummary || !repairOutcome) {
    redirect(`/diagnosticos/${diagnosticId}?error=Encerramento incompleto.`);
  }

  const { data: existing } = await supabase
    .from("resolved_cases")
    .select("id")
    .eq("diagnostic_id", diagnosticId)
    .maybeSingle();

  if (existing) {
    redirect(`/diagnosticos/${diagnosticId}?error=Este diagnostico ja foi encerrado.`);
  }

  const mappedStatus = caseStatus === "unresolved" ? "unresolved" : "resolved";

  const { error: diagnosticError } = await supabase
    .from("diagnostics")
    .update({
      status: mappedStatus,
      completed_at: new Date().toISOString(),
      current_summary: resolutionSummary,
    })
    .eq("id", diagnosticId);

  if (diagnosticError) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(diagnosticError.message)}`);
  }

  const { data: resolvedCase, error: resolvedError } = await supabase
    .from("resolved_cases")
    .insert({
      diagnostic_id: diagnosticId,
      case_status: caseStatus,
      resolution_summary: resolutionSummary,
      final_failure_mode: finalFailureMode,
      repair_outcome: repairOutcome,
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      knowledge_promoted_at:
        caseStatus === "confirmed" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (resolvedError) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(resolvedError.message)}`);
  }

  let confirmedCauseId: string | null = null;

  if (causeType && causeTitle && technicalExplanation) {
    const { data: cause, error: causeError } = await supabase
      .from("confirmed_causes")
      .insert({
        resolved_case_id: resolvedCase.id,
        cause_type: causeType,
        title: causeTitle,
        technical_explanation: technicalExplanation,
        is_primary: true,
      })
      .select("id")
      .single();

    if (causeError) {
      redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(causeError.message)}`);
    }

    confirmedCauseId = cause.id;
  }

  if (solutionType && solutionTitle && procedureDescription) {
    const { error: solutionError } = await supabase.from("applied_solutions").insert({
      resolved_case_id: resolvedCase.id,
      confirmed_cause_id: confirmedCauseId,
      solution_type: solutionType,
      title: solutionTitle,
      procedure_description: procedureDescription,
      was_effective: caseStatus !== "unresolved",
      performed_by_user_id: user.id,
      performed_at: new Date().toISOString(),
    });

    if (solutionError) {
      redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(solutionError.message)}`);
    }
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Diagnostico encerrado com sucesso.`);
}

export async function uploadTechnicalDocumentAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const documentType = String(formData.get("document_type") ?? "").trim();
  const manufacturerId =
    String(formData.get("manufacturer_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const file = formData.get("file");

  if (!title || !documentType || !(file instanceof File) || file.size === 0) {
    redirect("/biblioteca?error=Documento invalido.");
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("technical-documents")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    redirect(`/biblioteca?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error } = await supabase.from("technical_documents").insert({
    title,
    document_type: documentType,
    manufacturer_id: manufacturerId,
    storage_path: storagePath,
    mime_type: file.type || "application/octet-stream",
    file_size_bytes: file.size,
    notes,
  });

  if (error) {
    redirect(`/biblioteca?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/biblioteca");
  revalidatePath("/");
  redirect("/biblioteca?message=Documento tecnico enviado.");
}
