"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import {
  analyzeBoardImage,
  extractComponentReferenceFromImage,
  type ComponentOcrResult,
} from "@/lib/ai/image-analysis";
import { generateDiagnosticAssistantResponse } from "@/lib/services/assistant";
import {
  syncDiagnosticEmbeddingSource,
  syncResolvedCaseEmbeddingSource,
  syncSemanticBacklog,
  syncTechnicalDocumentSemanticSource,
} from "@/lib/services/semantic";
import { queueDiagnosticSemanticSync } from "@/lib/services/semantic-sync";
import { createClient } from "@/lib/supabase/server";

function isRedirectError(error: unknown): error is Error & { digest: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  return (
    (error as any).message === "NEXT_REDIRECT" ||
    (typeof (error as any).digest === "string" && (error as any).digest.startsWith("NEXT_REDIRECT"))
  );
}

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function readOptionalText(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function readOptionalNumber(formData: FormData, field: string) {
  const raw = String(formData.get(field) ?? "").trim();

  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readOptionalBoolean(formData: FormData, field: string) {
  const raw = String(formData.get(field) ?? "").trim();

  if (!raw) {
    return null;
  }

  if (raw === "yes") {
    return true;
  }

  if (raw === "no") {
    return false;
  }

  return null;
}

function compactDetails(value: Record<string, string | number | boolean | null>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== ""),
  );
}

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

  redirect("/login?message=Conta criada. Agora faça login.");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/login?error=Informe um email válido para recuperar a senha.");
  }

  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/redefinir-senha`,
  });

  redirect(
    "/login?message=Se o email existir, enviamos um link para redefinir a senha.",
  );
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createDiagnosticAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const categoryId = String(formData.get("equipment_category_id") ?? "").trim();
  const selectedManufacturerId =
    String(formData.get("manufacturer_id") ?? "").trim() || null;
  const selectedModelId =
    String(formData.get("equipment_model_id") ?? "").trim() || null;
  const newManufacturerName = readOptionalText(formData, "new_manufacturer_name");
  const newModelName = readOptionalText(formData, "new_model_name");
  const problemReport = String(formData.get("initial_problem_report") ?? "").trim();
  const physicalNotes = readOptionalText(formData, "physical_condition_notes");
  const serialNumber = readOptionalText(formData, "equipment_serial_number");
  const accessoriesIncluded = readOptionalText(formData, "accessories_included");
  const manufacturingYear = readOptionalNumber(formData, "manufacturing_year");
  const photoFiles = formData
    .getAll("equipment_photos")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (!categoryId || !problemReport) {
    redirect("/diagnosticos/novo?error=Categoria e relato inicial são obrigatórios.");
  }

  let manufacturerId = selectedManufacturerId;
  let manufacturerName: string | null = null;

  if (selectedManufacturerId === "__new__") {
    if (!newManufacturerName) {
      redirect("/diagnosticos/novo?error=Informe o nome do novo fabricante.");
    }

    const normalizedManufacturerName = normalizeText(newManufacturerName);
    const { data: existingManufacturer } = await supabase
      .from("manufacturers")
      .select("id, name")
      .eq("normalized_name", normalizedManufacturerName)
      .maybeSingle();

    if (existingManufacturer) {
      manufacturerId = existingManufacturer.id;
      manufacturerName = existingManufacturer.name;
    } else {
      const { data: createdManufacturer, error: manufacturerError } = await supabase
        .from("manufacturers")
        .insert({
          name: newManufacturerName,
          normalized_name: normalizedManufacturerName,
        })
        .select("id, name")
        .single();

      if (manufacturerError || !createdManufacturer) {
        redirect(
          `/diagnosticos/novo?error=${encodeURIComponent(manufacturerError?.message ?? "Falha ao criar fabricante.")}`,
        );
      }

      manufacturerId = createdManufacturer.id;
      manufacturerName = createdManufacturer.name;
    }
  } else if (manufacturerId) {
    const { data: manufacturer } = await supabase
      .from("manufacturers")
      .select("name")
      .eq("id", manufacturerId)
      .maybeSingle();

    manufacturerName = manufacturer?.name ?? null;
  }

  let equipmentModelId = selectedModelId;
  let modelName: string | null = null;

  if (selectedModelId === "__new__" || (!selectedModelId && newModelName)) {
    if (!newModelName) {
      redirect("/diagnosticos/novo?error=Informe o nome do novo modelo.");
    }

    if (!manufacturerId) {
      redirect("/diagnosticos/novo?error=Escolha ou crie um fabricante antes do modelo.");
    }

    const normalizedModelName = normalizeText(newModelName);
    const { data: existingModel } = await supabase
      .from("equipment_models")
      .select("id, model_name")
      .eq("manufacturer_id", manufacturerId)
      .eq("normalized_model_name", normalizedModelName)
      .maybeSingle();

    if (existingModel) {
      equipmentModelId = existingModel.id;
      modelName = existingModel.model_name;
    } else {
      const { data: createdModel, error: modelError } = await supabase
        .from("equipment_models")
        .insert({
          manufacturer_id: manufacturerId,
          equipment_category_id: categoryId,
          model_name: newModelName,
          normalized_model_name: normalizedModelName,
        })
        .select("id, model_name")
        .single();

      if (modelError || !createdModel) {
        redirect(
          `/diagnosticos/novo?error=${encodeURIComponent(modelError?.message ?? "Falha ao criar modelo.")}`,
        );
      }

      equipmentModelId = createdModel.id;
      modelName = createdModel.model_name;
    }
  } else if (equipmentModelId) {
    const { data: model } = await supabase
      .from("equipment_models")
      .select("model_name")
      .eq("id", equipmentModelId)
      .maybeSingle();

    modelName = model?.model_name ?? null;
  }

  const equipmentDetails = compactDetails({
    manufacturingYear,
    accessoriesIncluded,
    tvScreenSizeInches: readOptionalNumber(formData, "tv_screen_size_inches"),
    tvScreenType: readOptionalText(formData, "tv_screen_type"),
    tvKind: readOptionalText(formData, "tv_kind"),
    tvResolution: readOptionalText(formData, "tv_resolution"),
    tvPanelCode: readOptionalText(formData, "tv_panel_code"),
    notebookProcessor: readOptionalText(formData, "notebook_processor"),
    notebookRamGb: readOptionalNumber(formData, "notebook_ram_gb"),
    notebookStorageType: readOptionalText(formData, "notebook_storage_type"),
    notebookStorageCapacityGb: readOptionalNumber(formData, "notebook_storage_capacity_gb"),
    notebookScreenSizeInches: readOptionalNumber(formData, "notebook_screen_size_inches"),
    notebookChargerIncluded: readOptionalBoolean(formData, "notebook_charger_included"),
    smartphoneStorageGb: readOptionalNumber(formData, "smartphone_storage_gb"),
    smartphoneColor: readOptionalText(formData, "smartphone_color"),
    smartphoneDualSim: readOptionalBoolean(formData, "smartphone_dual_sim"),
    smartphoneBiometric: readOptionalText(formData, "smartphone_biometric"),
    smartphoneNetworkType: readOptionalText(formData, "smartphone_network_type"),
    desktopProcessor: readOptionalText(formData, "desktop_processor"),
    desktopRamGb: readOptionalNumber(formData, "desktop_ram_gb"),
    desktopStorageType: readOptionalText(formData, "desktop_storage_type"),
    desktopStorageCapacityGb: readOptionalNumber(formData, "desktop_storage_capacity_gb"),
    desktopDedicatedGpu: readOptionalBoolean(formData, "desktop_dedicated_gpu"),
    desktopPsuWatts: readOptionalNumber(formData, "desktop_psu_watts"),
  });

  const labelParts = [manufacturerName, modelName].filter(Boolean);
  const computedLabel = labelParts.length
    ? labelParts.join(" ")
    : serialNumber
      ? `Equipamento ${serialNumber}`
      : null;

  const { data, error } = await supabase
    .from("diagnostics")
    .insert({
      equipment_category_id: categoryId,
      manufacturer_id: manufacturerId,
      equipment_model_id: equipmentModelId,
      opened_by_user_id: user.id,
      status: "active",
      priority: "normal",
      equipment_serial_number: serialNumber,
      equipment_label: computedLabel,
      initial_problem_report: problemReport,
      physical_condition_notes: physicalNotes,
      current_summary: problemReport,
      equipment_details: equipmentDetails,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/diagnosticos/novo?error=${encodeURIComponent(error.message)}`);
  }

  let uploadedPhotos = 0;

  for (const [index, file] of photoFiles.entries()) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${data.id}/${Date.now()}-${index + 1}-${safeName}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("diagnostic-attachments")
      .upload(storagePath, bytes, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      continue;
    }

    const { error: attachmentError } = await supabase.from("attachments").insert({
      diagnostic_id: data.id,
      attachment_type: "photo",
      title: `Foto do equipamento ${index + 1}`,
      description: "Imagem enviada no cadastro inicial do equipamento.",
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      uploaded_by_user_id: user.id,
    });

    if (!attachmentError) {
      uploadedPhotos += 1;
    }
  }

  await syncDiagnosticEmbeddingSource(data.id, supabase);
  revalidatePath("/");
  revalidatePath(`/diagnosticos/${data.id}`);

  const message =
    uploadedPhotos > 0
      ? `Equipamento cadastrado com ${uploadedPhotos} foto(s).`
      : "Equipamento cadastrado com sucesso.";

  redirect(`/diagnosticos/${data.id}?message=${encodeURIComponent(message)}`);
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
    redirect(`/diagnosticos/${diagnosticId}?error=Sintoma inválido.`);
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

  void queueDiagnosticSemanticSync(diagnosticId);
  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Sintoma registrado.`);
}

export async function addDiagnosticTestAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const testId = String(formData.get("test_id") ?? "");
  const requestedByAiResponseId =
    String(formData.get("requested_by_ai_response_id") ?? "").trim() || null;
  const procedureNotes =
    String(formData.get("procedure_notes") ?? "").trim() || null;
  const actualResult = String(formData.get("actual_result") ?? "").trim() || null;
  const resultStatus = String(formData.get("result_status") ?? "pending");

  if (!diagnosticId || !testId) {
    redirect(`/diagnosticos/${diagnosticId}?error=Teste inválido.`);
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
    requested_by_ai_response_id: requestedByAiResponseId,
    result_status: resultStatus,
    procedure_notes: procedureNotes,
    actual_result: actualResult,
  });

  if (error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(error.message)}`);
  }

  void queueDiagnosticSemanticSync(diagnosticId);
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
    redirect(`/diagnosticos/${diagnosticId}?error=Medição inválida.`);
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

  void queueDiagnosticSemanticSync(diagnosticId);
  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  redirect(`/diagnosticos/${diagnosticId}?message=Medição registrada.`);
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
    redirect(`/diagnosticos/${diagnosticId}?error=Hipótese inválida.`);
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

  void queueDiagnosticSemanticSync(diagnosticId);
  revalidatePath(`/diagnosticos/${diagnosticId}`);
  redirect(`/diagnosticos/${diagnosticId}?message=Hipótese registrada.`);
}

export async function generateDiagnosticAssistantAction(formData: FormData) {
  await requireCurrentUser();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");

  if (!diagnosticId) {
    redirect("/?error=Diagnóstico inválido para recomendação.");
  }

  try {
    const result = await generateDiagnosticAssistantResponse(diagnosticId);
    revalidatePath(`/diagnosticos/${diagnosticId}`);
    redirect(
      `/diagnosticos/${diagnosticId}?message=${encodeURIComponent(
        `Assistente técnico atualizado com confiança ${result.confidence.toFixed(2)} usando ${result.provider}.`,
      )}`,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Falha ao gerar recomendação técnica.";
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(message)}`);
  }
}

export async function saveAssistantFeedbackAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "").trim();
  const aiResponseId = String(formData.get("ai_response_id") ?? "").trim();
  const feedbackRating = String(formData.get("feedback_rating") ?? "").trim();
  const wasFollowedRaw = String(formData.get("was_followed") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!diagnosticId || !aiResponseId || !feedbackRating) {
    redirect(`/diagnosticos/${diagnosticId || ""}?error=Feedback da IA incompleto.`);
  }

  const wasFollowed =
    wasFollowedRaw === "yes" ? true : wasFollowedRaw === "no" ? false : null;

  const { data: existing } = await supabase
    .from("ai_response_feedback")
    .select("id")
    .eq("ai_response_id", aiResponseId)
    .maybeSingle();

  const payload = {
    ai_response_id: aiResponseId,
    diagnostic_id: diagnosticId,
    feedback_rating: feedbackRating,
    was_followed: wasFollowed,
    note,
    submitted_by_user_id: user.id,
  };

  const result = existing?.id
    ? await supabase
        .from("ai_response_feedback")
        .update(payload)
        .eq("id", existing.id)
    : await supabase.from("ai_response_feedback").insert(payload);

  if (result.error) {
    redirect(`/diagnosticos/${diagnosticId}?error=${encodeURIComponent(result.error.message)}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/conhecimento");
  redirect(`/diagnosticos/${diagnosticId}?message=Feedback da recomendação salvo.`);
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
    redirect(`/diagnosticos/${diagnosticId}?error=Anexo inválido.`);
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

export async function analyzeAttachmentImageAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const diagnosticId = String(formData.get("diagnostic_id") ?? "");
  const attachmentId = String(formData.get("attachment_id") ?? "");

  if (!diagnosticId || !attachmentId) {
    redirect(`/diagnosticos/${diagnosticId}?error=Anexo inválido para análise.`);
  }

  const { data: attachment } = await supabase
    .from("attachments")
    .select("id, storage_path, mime_type")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment || !attachment.mime_type.startsWith("image/")) {
    redirect(`/diagnosticos/${diagnosticId}?error=Este anexo não é uma imagem analisável.`);
  }

  const { data: signed } = await supabase.storage
    .from("diagnostic-attachments")
    .createSignedUrl(attachment.storage_path, 300);

  if (!signed?.signedUrl) {
    redirect(`/diagnosticos/${diagnosticId}?error=Não foi possível gerar acesso à imagem.`);
  }

  let analysis: Awaited<ReturnType<typeof analyzeBoardImage>> = null;

  try {
    analysis = await analyzeBoardImage(signed.signedUrl);
  } catch {
    redirect(`/diagnosticos/${diagnosticId}?error=Falha ao analisar a imagem. Tente novamente.`);
  }

  if (!analysis) {
    redirect(`/diagnosticos/${diagnosticId}?error=Análise de imagem não está configurada.`);
  }

  await supabase
    .from("attachments")
    .update({
      ai_image_analysis: analysis,
      ai_image_analyzed_at: new Date().toISOString(),
    })
    .eq("id", attachmentId);

  revalidatePath(`/diagnosticos/${diagnosticId}`);
  redirect(`/diagnosticos/${diagnosticId}?message=Análise de imagem concluída.`);
}

export async function extractAttachmentComponentRefAction(
  diagnosticId: string,
  attachmentId: string,
): Promise<ComponentOcrResult> {
  await requireCurrentUser();
  const supabase = await createClient();

  if (!diagnosticId || !attachmentId) {
    throw new Error("Anexo inválido para OCR.");
  }

  const { data: attachment } = await supabase
    .from("attachments")
    .select("id, storage_path, mime_type")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment || !attachment.mime_type.startsWith("image/")) {
    throw new Error("Este anexo não é uma imagem utilizável para OCR.");
  }

  const { data: signed } = await supabase.storage
    .from("diagnostic-attachments")
    .createSignedUrl(attachment.storage_path, 300);

  if (!signed?.signedUrl) {
    throw new Error("Não foi possível gerar acesso temporário à imagem.");
  }

  const result = await extractComponentReferenceFromImage(signed.signedUrl);

  if (!result) {
    throw new Error("OCR de componentes não está configurado.");
  }

  return result;
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
    redirect(`/diagnosticos/${diagnosticId}?error=Este diagnóstico já foi encerrado.`);
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

  await syncDiagnosticEmbeddingSource(diagnosticId, supabase);
  await syncResolvedCaseEmbeddingSource(diagnosticId, supabase);
  revalidatePath(`/diagnosticos/${diagnosticId}`);
  revalidatePath("/");
  revalidatePath("/conhecimento");
  redirect(`/diagnosticos/${diagnosticId}?message=Diagnóstico encerrado com sucesso.`);
}

export async function uploadTechnicalDocumentAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const title = String(formData.get("title") ?? "").trim();
  const documentType = String(formData.get("document_type") ?? "").trim();
  const manufacturerId =
    String(formData.get("manufacturer_id") ?? "").trim() || null;
  const equipmentModelId =
    String(formData.get("equipment_model_id") ?? "").trim() || null;
  const boardId =
    String(formData.get("board_id") ?? "").trim() || null;
  const componentId =
    String(formData.get("component_id") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const file = formData.get("file");

  if (
    !title ||
    !documentType ||
    (!manufacturerId && !equipmentModelId && !boardId && !componentId) ||
    !(file instanceof File) ||
    file.size === 0
  ) {
    redirect("/biblioteca?error=Documento inválido. Forneça o título, tipo, arquivo e pelo menos uma relação (fabricante, modelo, placa ou componente).");
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

  const { data: insertedDocument, error } = await supabase
    .from("technical_documents")
    .insert({
      title,
      document_type: documentType,
      manufacturer_id: manufacturerId,
      equipment_model_id: equipmentModelId,
      board_id: boardId,
      component_id: componentId,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      file_size_bytes: file.size,
      notes,
    })
    .select("id")
    .single();

  if (error || !insertedDocument) {
    redirect(
      `/biblioteca?error=${encodeURIComponent(error?.message ?? "Falha ao registrar o documento.")}`,
    );
  }

  let message = "Documento técnico enviado.";

  try {
    const result = await syncTechnicalDocumentSemanticSource(
      insertedDocument.id,
      file,
      supabase,
    );

    message = `Documento técnico enviado e indexado em ${result.chunksCount} chunks.`;
  } catch {
    await supabase
      .from("technical_documents")
      .update({ is_indexed: false })
      .eq("id", insertedDocument.id);

    message = "Documento técnico enviado, mas a indexação inicial ficou pendente.";
  }

  revalidatePath("/biblioteca");
  revalidatePath("/busca");
  revalidatePath("/conhecimento");
  revalidatePath("/");
  redirect(`/biblioteca?message=${encodeURIComponent(message)}`);
}

export async function syncSemanticMemoryAction() {
  await requireCurrentUser();

  try {
    const result = await syncSemanticBacklog();
    revalidatePath("/busca");
    revalidatePath("/conhecimento");
    revalidatePath("/biblioteca");
    redirect(
      `/conhecimento?message=${encodeURIComponent(
        `Memória inteligente sincronizada com ${result.processed} registros usando ${result.provider}.`,
      )}`,
    );
  } catch (error) {
    try {
      const fs = require("fs");
      fs.writeFileSync(
        "c:/Users/User/Projetos/Antigravity/ConsertosPro/error_debug.log",
        JSON.stringify({
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : null,
          stack: error instanceof Error ? error.stack : null,
          digest: error && typeof error === "object" && "digest" in error ? (error as any).digest : null,
          isRedirect: isRedirectError(error),
        }, null, 2)
      );
    } catch (e) {
      // ignore log write errors
    }

    if (
      isRedirectError(error) ||
      (error instanceof Error && error.message === "NEXT_REDIRECT") ||
      (error && typeof error === "object" && "digest" in error && String((error as any).digest).startsWith("NEXT_REDIRECT"))
    ) {
      throw error;
    }
    const message =
      error instanceof Error ? error.message : "Falha ao sincronizar memória inteligente.";
    redirect(`/conhecimento?error=${encodeURIComponent(message)}`);
  }
}

export async function saveAttachmentAnnotationsAction(
  attachmentId: string,
  diagnosticId: string,
  annotations: any[]
) {
  await requireCurrentUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("attachments")
    .update({
      annotations: annotations,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attachmentId);

  if (error) {
    throw new Error(`Falha ao salvar as anotações: ${error.message}`);
  }

  revalidatePath(`/diagnosticos/${diagnosticId}`);
}

export async function reviewResolvedCaseAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const resolvedCaseId = String(formData.get("resolved_case_id") ?? "").trim();
  const reviewStatus = String(formData.get("review_status") ?? "").trim();
  const reviewNotes = String(formData.get("review_notes") ?? "").trim() || null;

  if (!resolvedCaseId || !reviewStatus) {
    redirect("/conhecimento?error=Dados inválidos para revisão.");
  }

  const { error: reviewError } = await supabase
    .from("entity_reviews")
    .insert({
      entity_type: "resolved_case",
      entity_id: resolvedCaseId,
      review_status: reviewStatus,
      review_notes: reviewNotes,
      reviewed_by_user_id: user.id,
    });

  if (reviewError) {
    redirect(`/conhecimento?error=${encodeURIComponent(reviewError.message)}`);
  }

  const isApproved = reviewStatus === "approved";
  const { error: resolvedError } = await supabase
    .from("resolved_cases")
    .update({
      reviewed_by_user_id: user.id,
      reviewed_at: new Date().toISOString(),
      knowledge_promoted_at: isApproved ? new Date().toISOString() : null,
    })
    .eq("id", resolvedCaseId);

  if (resolvedError) {
    redirect(`/conhecimento?error=${encodeURIComponent(resolvedError.message)}`);
  }

  revalidatePath("/conhecimento");
  revalidatePath("/configuracoes");
  redirect("/conhecimento?message=Revisão registrada com sucesso.");
}

export async function addBoardMeasurementAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const boardId = String(formData.get("board_id") ?? "").trim();
  const componentRef = String(formData.get("component_ref") ?? "").trim();
  const measurementPoint = String(formData.get("measurement_point") ?? "").trim();
  const expectedValue = String(formData.get("expected_value") ?? "").trim();
  const condition = String(formData.get("condition") ?? "").trim() || "power_off";
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const diagnosticId = String(formData.get("diagnostic_id") ?? "").trim();

  if (!boardId || !componentRef || !measurementPoint || !expectedValue) {
    throw new Error("Preencha todos os campos obrigatórios para salvar a medição.");
  }

  const { error } = await supabase
    .from("board_measurements")
    .insert({
      board_id: boardId,
      component_ref: componentRef,
      measurement_point: measurementPoint,
      expected_value: expectedValue,
      condition,
      notes,
      created_by_user_id: user.id,
    });

  if (error) {
    throw new Error(`Falha ao registrar medição de referência: ${error.message}`);
  }

  if (diagnosticId) {
    revalidatePath(`/diagnosticos/${diagnosticId}`);
  }
}
