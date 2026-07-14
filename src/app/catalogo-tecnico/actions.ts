"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function toSlug(value: string) {
  return normalizeText(value).replace(/\s+/g, "-");
}

function readOptionalText(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function isUniqueViolation(error: { code?: string } | null | undefined) {
  return error?.code === "23505";
}

async function ensureRecordExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  id: string | null,
) {
  if (!id) {
    return false;
  }

  const { data } = await supabase.from(table).select("id").eq("id", id).maybeSingle();
  return Boolean(data?.id);
}

export async function createCategoryAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = toSlug(name);
  const description = readOptionalText(formData, "description");

  if (!name) {
    redirect("/catalogo-tecnico?tab=categorias&error=Nome é obrigatório.");
  }

  const { data: existingCategory } = await supabase
    .from("equipment_categories")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (existingCategory) {
    redirect("/catalogo-tecnico?tab=categorias&success=Categoria já cadastrada e pronta para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("equipment_categories")
    .insert({
      name,
      slug,
      description,
    })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=categorias&success=Categoria já cadastrada e pronta para uso.");
    }

    redirect(`/catalogo-tecnico?tab=categorias&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "equipment_category",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.name,
      change_reason: "Cadastro de nova categoria de equipamento",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=categorias&success=Categoria criada com sucesso!");
}

export async function createManufacturerAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const normalizedName = normalizeText(name);
  const country = readOptionalText(formData, "country");
  const notes = readOptionalText(formData, "notes");

  if (!name) {
    redirect("/catalogo-tecnico?tab=fabricantes&error=Nome é obrigatório.");
  }

  const { data: existingManufacturer } = await supabase
    .from("manufacturers")
    .select("id, name")
    .eq("normalized_name", normalizedName)
    .maybeSingle();

  if (existingManufacturer) {
    redirect("/catalogo-tecnico?tab=fabricantes&success=Fabricante já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("manufacturers")
    .insert({
      name,
      normalized_name: normalizedName,
      country,
      notes,
    })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=fabricantes&success=Fabricante já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=fabricantes&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "manufacturer",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.name,
      change_reason: "Cadastro de novo fabricante",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=fabricantes&success=Fabricante criado com sucesso!");
}

export async function createBoardTypeAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = toSlug(name);
  const description = readOptionalText(formData, "description");

  if (!name) {
    redirect("/catalogo-tecnico?tab=tipos-de-placa&error=Nome é obrigatório.");
  }

  const { data: existingBoardType } = await supabase
    .from("board_types")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (existingBoardType) {
    redirect("/catalogo-tecnico?tab=tipos-de-placa&success=Tipo de placa já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("board_types")
    .insert({
      name,
      slug,
      description,
    })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=tipos-de-placa&success=Tipo de placa já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=tipos-de-placa&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "board_type",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.name,
      change_reason: "Cadastro de novo tipo de placa",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=tipos-de-placa&success=Tipo de placa criado com sucesso!");
}

export async function createModelAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const manufacturerId = String(formData.get("manufacturer_id") ?? "").trim();
  const equipmentCategoryId = String(formData.get("equipment_category_id") ?? "").trim();
  const modelName = String(formData.get("model_name") ?? "").trim();
  const familyName = readOptionalText(formData, "family_name");
  const revisionLabel = readOptionalText(formData, "revision_label");
  const releaseNotes = readOptionalText(formData, "release_notes");

  if (!manufacturerId || !equipmentCategoryId || !modelName) {
    redirect("/catalogo-tecnico?tab=modelos&error=Fabricante, categoria e nome do modelo são obrigatórios.");
  }

  const manufacturerExists = await ensureRecordExists(supabase, "manufacturers", manufacturerId);
  const categoryExists = await ensureRecordExists(supabase, "equipment_categories", equipmentCategoryId);

  if (!manufacturerExists || !categoryExists) {
    redirect("/catalogo-tecnico?tab=modelos&error=Fabricante ou categoria inválidos. Atualize a tela e tente novamente.");
  }

  const normalizedModelName = normalizeText(modelName);
  const { data: existingModel } = await supabase
    .from("equipment_models")
    .select("id, model_name, equipment_category_id")
    .eq("manufacturer_id", manufacturerId)
    .eq("normalized_model_name", normalizedModelName)
    .maybeSingle();

  if (existingModel) {
    if (existingModel.equipment_category_id !== equipmentCategoryId) {
      redirect("/catalogo-tecnico?tab=modelos&error=Já existe um modelo com esse nome para o fabricante em outra categoria.");
    }

    redirect("/catalogo-tecnico?tab=modelos&success=Modelo já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("equipment_models")
    .insert({
      manufacturer_id: manufacturerId,
      equipment_category_id: equipmentCategoryId,
      model_name: modelName,
      normalized_model_name: normalizedModelName,
      family_name: familyName,
      revision_label: revisionLabel,
      release_notes: releaseNotes,
    })
    .select("id, model_name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=modelos&success=Modelo já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=modelos&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "equipment_model",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.model_name,
      change_reason: "Cadastro de novo modelo de equipamento",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=modelos&success=Modelo criado com sucesso!");
}

export async function createBoardAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const boardTypeId = String(formData.get("board_type_id") ?? "").trim();
  const manufacturerId = readOptionalText(formData, "manufacturer_id");
  const boardCode = String(formData.get("board_code") ?? "").trim();
  const boardRevision = readOptionalText(formData, "board_revision");
  const description = readOptionalText(formData, "description");
  const notes = readOptionalText(formData, "notes");

  if (!boardTypeId || !boardCode) {
    redirect("/catalogo-tecnico?tab=placas&error=Tipo de placa e código da placa são obrigatórios.");
  }

  const boardTypeExists = await ensureRecordExists(supabase, "board_types", boardTypeId);
  const manufacturerExists =
    !manufacturerId || (await ensureRecordExists(supabase, "manufacturers", manufacturerId));

  if (!boardTypeExists || !manufacturerExists) {
    redirect("/catalogo-tecnico?tab=placas&error=Tipo de placa ou fabricante inválidos. Atualize a tela e tente novamente.");
  }

  const { data: existingBoard } = await supabase
    .from("boards")
    .select("id")
    .eq("board_code", boardCode)
    .eq("board_revision", boardRevision)
    .maybeSingle();

  if (existingBoard) {
    redirect("/catalogo-tecnico?tab=placas&success=Placa já cadastrada e pronta para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("boards")
    .insert({
      board_type_id: boardTypeId,
      manufacturer_id: manufacturerId,
      board_code: boardCode,
      board_revision: boardRevision,
      description,
      notes,
    })
    .select("id, board_code")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=placas&success=Placa já cadastrada e pronta para uso.");
    }

    redirect(`/catalogo-tecnico?tab=placas&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "board",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.board_code,
      change_reason: "Cadastro de nova placa técnica",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=placas&success=Placa criada com sucesso!");
}

export async function createComponentAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const componentRef = String(formData.get("component_ref") ?? "").trim();
  const componentType = String(formData.get("component_type") ?? "").trim();
  const manufacturerPartNumber = readOptionalText(formData, "manufacturer_part_number");
  const genericPartNumber = readOptionalText(formData, "generic_part_number");
  const description = readOptionalText(formData, "description");
  const packageType = readOptionalText(formData, "package_type");
  const datasheetSummary = readOptionalText(formData, "datasheet_summary");
  const notes = readOptionalText(formData, "notes");

  if (!componentRef || !componentType) {
    redirect("/catalogo-tecnico?tab=componentes&error=Referência e tipo de componente são obrigatórios.");
  }

  const { data: existingComponent } = await supabase
    .from("components")
    .select("id")
    .eq("component_ref", componentRef)
    .maybeSingle();

  if (existingComponent) {
    redirect("/catalogo-tecnico?tab=componentes&success=Componente já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("components")
    .insert({
      component_ref: componentRef,
      component_type: componentType,
      manufacturer_part_number: manufacturerPartNumber,
      generic_part_number: genericPartNumber,
      description,
      package_type: packageType,
      datasheet_summary: datasheetSummary,
      notes,
    })
    .select("id, component_ref")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=componentes&success=Componente já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=componentes&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "component",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.component_ref,
      change_reason: "Cadastro de novo componente mestre",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=componentes&success=Componente criado com sucesso!");
}

export async function createModelBoardAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const equipmentModelId = String(formData.get("equipment_model_id") ?? "").trim();
  const boardId = String(formData.get("board_id") ?? "").trim();
  const roleLabel = String(formData.get("role_label") ?? "").trim();
  const isPrimary = formData.get("is_primary") === "on";
  const notes = readOptionalText(formData, "notes");

  if (!equipmentModelId || !boardId || !roleLabel) {
    redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&error=Modelo, placa e função são obrigatórios.");
  }

  const modelExists = await ensureRecordExists(supabase, "equipment_models", equipmentModelId);
  const boardExists = await ensureRecordExists(supabase, "boards", boardId);

  if (!modelExists || !boardExists) {
    redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&error=Modelo ou placa inválidos. Atualize a tela e tente novamente.");
  }

  const { data: existingLink } = await supabase
    .from("model_boards")
    .select("id")
    .eq("equipment_model_id", equipmentModelId)
    .eq("board_id", boardId)
    .eq("role_label", roleLabel)
    .maybeSingle();

  if (existingLink) {
    redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&success=Vínculo entre modelo e placa já cadastrado.");
  }

  const { data: createdRow, error } = await supabase
    .from("model_boards")
    .insert({
      equipment_model_id: equipmentModelId,
      board_id: boardId,
      role_label: roleLabel,
      is_primary: isPrimary,
      notes,
    })
    .select("id, role_label")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&success=Vínculo entre modelo e placa já cadastrado.");
    }

    redirect(`/catalogo-tecnico?tab=vinculos-modelo-placa&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "model_board",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.role_label,
      change_reason: "Vínculo entre modelo e placa no catálogo",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&success=Vínculo entre modelo e placa criado com sucesso!");
}

export async function createBoardComponentAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const boardId = String(formData.get("board_id") ?? "").trim();
  const componentId = String(formData.get("component_id") ?? "").trim();
  const referenceDesignator = String(formData.get("reference_designator") ?? "").trim();
  const circuitFunction = readOptionalText(formData, "circuit_function");
  const expectedBehavior = readOptionalText(formData, "expected_behavior");
  const locationNotes = readOptionalText(formData, "location_notes");
  const isCritical = formData.get("is_critical") === "on";
  const notes = readOptionalText(formData, "notes");

  if (!boardId || !componentId || !referenceDesignator) {
    redirect("/catalogo-tecnico?tab=componentes-placa&error=Placa, componente e designador de referência são obrigatórios.");
  }

  const boardExists = await ensureRecordExists(supabase, "boards", boardId);
  const componentExists = await ensureRecordExists(supabase, "components", componentId);

  if (!boardExists || !componentExists) {
    redirect("/catalogo-tecnico?tab=componentes-placa&error=Placa ou componente inválidos. Atualize a tela e tente novamente.");
  }

  const { data: existingBoardComponent } = await supabase
    .from("board_components")
    .select("id")
    .eq("board_id", boardId)
    .eq("reference_designator", referenceDesignator)
    .maybeSingle();

  if (existingBoardComponent) {
    redirect("/catalogo-tecnico?tab=componentes-placa&success=Esse componente já está vinculado à placa.");
  }

  const { data: createdRow, error } = await supabase
    .from("board_components")
    .insert({
      board_id: boardId,
      component_id: componentId,
      reference_designator: referenceDesignator,
      circuit_function: circuitFunction,
      expected_behavior: expectedBehavior,
      location_notes: locationNotes,
      is_critical: isCritical,
      notes,
    })
    .select("id, reference_designator")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=componentes-placa&success=Esse componente já está vinculado à placa.");
    }

    redirect(`/catalogo-tecnico?tab=componentes-placa&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "board_component",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.reference_designator,
      change_reason: "Vínculo de componente à placa no catálogo",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=componentes-placa&success=Componente vinculado à placa com sucesso!");
}

export async function createSymptomAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const equipmentCategoryId = String(formData.get("equipment_category_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = readOptionalText(formData, "description");
  const symptomGroup = readOptionalText(formData, "symptom_group");

  if (!equipmentCategoryId || !name) {
    redirect("/catalogo-tecnico?tab=sintomas&error=Categoria e nome do sintoma são obrigatórios.");
  }

  const categoryExists = await ensureRecordExists(supabase, "equipment_categories", equipmentCategoryId);

  if (!categoryExists) {
    redirect("/catalogo-tecnico?tab=sintomas&error=Categoria inválida. Atualize a tela e tente novamente.");
  }

  const slug = toSlug(name);
  const { data: existingSymptom } = await supabase
    .from("symptoms")
    .select("id, name")
    .eq("equipment_category_id", equipmentCategoryId)
    .eq("slug", slug)
    .maybeSingle();

  if (existingSymptom) {
    redirect("/catalogo-tecnico?tab=sintomas&success=Sintoma já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("symptoms")
    .insert({
      equipment_category_id: equipmentCategoryId,
      name,
      slug,
      description,
      symptom_group: symptomGroup,
    })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=sintomas&success=Sintoma já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=sintomas&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "symptom",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.name,
      change_reason: "Cadastro de novo sintoma no catálogo",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=sintomas&success=Sintoma criado com sucesso!");
}

export async function createTestAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const testGroup = readOptionalText(formData, "test_group");
  const description = readOptionalText(formData, "description");
  const defaultUnit = readOptionalText(formData, "default_unit");

  if (!name) {
    redirect("/catalogo-tecnico?tab=testes&error=Nome do teste é obrigatório.");
  }

  const slug = toSlug(name);
  const { data: existingTest } = await supabase
    .from("tests")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (existingTest) {
    redirect("/catalogo-tecnico?tab=testes&success=Teste já cadastrado e pronto para uso.");
  }

  const { data: createdRow, error } = await supabase
    .from("tests")
    .insert({
      name,
      slug,
      test_group: testGroup,
      description,
      default_unit: defaultUnit,
    })
    .select("id, name")
    .single();

  if (error) {
    if (isUniqueViolation(error)) {
      redirect("/catalogo-tecnico?tab=testes&success=Teste já cadastrado e pronto para uso.");
    }

    redirect(`/catalogo-tecnico?tab=testes&error=${encodeURIComponent(error.message)}`);
  }

  if (createdRow) {
    await supabase.from("change_history").insert({
      entity_type: "test",
      entity_id: createdRow.id,
      change_type: "create",
      field_name: "all",
      new_value_text: createdRow.name,
      change_reason: "Cadastro de novo teste no catálogo",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=testes&success=Teste criado com sucesso!");
}
