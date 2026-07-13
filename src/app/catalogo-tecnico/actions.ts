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

function readOptionalText(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

export async function createCategoryAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeText(name).replace(/\s+/g, "-");
  const description = readOptionalText(formData, "description");

  if (!name) {
    redirect("/catalogo-tecnico?tab=categorias&error=Nome é obrigatório.");
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
  const normalized_name = normalizeText(name);
  const country = readOptionalText(formData, "country");
  const notes = readOptionalText(formData, "notes");

  if (!name) {
    redirect("/catalogo-tecnico?tab=fabricantes&error=Nome é obrigatório.");
  }

  const { data: createdRow, error } = await supabase
    .from("manufacturers")
    .insert({
      name,
      normalized_name,
      country,
      notes,
    })
    .select("id, name")
    .single();

  if (error) {
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
  const slug = normalizeText(name).replace(/\s+/g, "-");
  const description = readOptionalText(formData, "description");

  if (!name) {
    redirect("/catalogo-tecnico?tab=tipos-de-placa&error=Nome é obrigatório.");
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

  const manufacturer_id = String(formData.get("manufacturer_id") ?? "").trim();
  const equipment_category_id = String(formData.get("equipment_category_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const family_name = readOptionalText(formData, "family_name");
  const revision_label = readOptionalText(formData, "revision_label");
  const release_notes = readOptionalText(formData, "release_notes");

  if (!manufacturer_id || !equipment_category_id || !model_name) {
    redirect("/catalogo-tecnico?tab=modelos&error=Fabricante, categoria e nome do modelo são obrigatórios.");
  }

  const normalized_model_name = normalizeText(model_name);

  const { data: createdRow, error } = await supabase
    .from("equipment_models")
    .insert({
      manufacturer_id,
      equipment_category_id,
      model_name,
      normalized_model_name,
      family_name,
      revision_label,
      release_notes,
    })
    .select("id, model_name")
    .single();

  if (error) {
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

  const board_type_id = String(formData.get("board_type_id") ?? "").trim();
  const manufacturer_id = readOptionalText(formData, "manufacturer_id");
  const board_code = String(formData.get("board_code") ?? "").trim();
  const board_revision = readOptionalText(formData, "board_revision");
  const description = readOptionalText(formData, "description");
  const notes = readOptionalText(formData, "notes");

  if (!board_type_id || !board_code) {
    redirect("/catalogo-tecnico?tab=placas&error=Tipo de placa e código da placa são obrigatórios.");
  }

  const { data: createdRow, error } = await supabase
    .from("boards")
    .insert({
      board_type_id,
      manufacturer_id,
      board_code,
      board_revision,
      description,
      notes,
    })
    .select("id, board_code")
    .single();

  if (error) {
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

  const component_ref = String(formData.get("component_ref") ?? "").trim();
  const component_type = String(formData.get("component_type") ?? "").trim();
  const manufacturer_part_number = readOptionalText(formData, "manufacturer_part_number");
  const generic_part_number = readOptionalText(formData, "generic_part_number");
  const description = readOptionalText(formData, "description");
  const package_type = readOptionalText(formData, "package_type");
  const datasheet_summary = readOptionalText(formData, "datasheet_summary");
  const notes = readOptionalText(formData, "notes");

  if (!component_ref || !component_type) {
    redirect("/catalogo-tecnico?tab=componentes&error=Referência e tipo de componente são obrigatórios.");
  }

  const { data: createdRow, error } = await supabase
    .from("components")
    .insert({
      component_ref,
      component_type,
      manufacturer_part_number,
      generic_part_number,
      description,
      package_type,
      datasheet_summary,
      notes,
    })
    .select("id, component_ref")
    .single();

  if (error) {
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

  const equipment_model_id = String(formData.get("equipment_model_id") ?? "").trim();
  const board_id = String(formData.get("board_id") ?? "").trim();
  const role_label = String(formData.get("role_label") ?? "").trim();
  const is_primary = formData.get("is_primary") === "on";
  const notes = readOptionalText(formData, "notes");

  if (!equipment_model_id || !board_id || !role_label) {
    redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&error=Modelo, placa e função são obrigatórios.");
  }

  const { data: createdRow, error } = await supabase
    .from("model_boards")
    .insert({
      equipment_model_id,
      board_id,
      role_label,
      is_primary,
      notes,
    })
    .select("id, role_label")
    .single();

  if (error) {
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

  const board_id = String(formData.get("board_id") ?? "").trim();
  const component_id = String(formData.get("component_id") ?? "").trim();
  const reference_designator = String(formData.get("reference_designator") ?? "").trim();
  const circuit_function = readOptionalText(formData, "circuit_function");
  const expected_behavior = readOptionalText(formData, "expected_behavior");
  const location_notes = readOptionalText(formData, "location_notes");
  const is_critical = formData.get("is_critical") === "on";
  const notes = readOptionalText(formData, "notes");

  if (!board_id || !component_id || !reference_designator) {
    redirect("/catalogo-tecnico?tab=componentes-placa&error=Placa, componente e designador de referência são obrigatórios.");
  }

  const { data: createdRow, error } = await supabase
    .from("board_components")
    .insert({
      board_id,
      component_id,
      reference_designator,
      circuit_function,
      expected_behavior,
      location_notes,
      is_critical,
      notes,
    })
    .select("id, reference_designator")
    .single();

  if (error) {
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

  const equipment_category_id = String(formData.get("equipment_category_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = readOptionalText(formData, "description");
  const symptom_group = readOptionalText(formData, "symptom_group");

  if (!equipment_category_id || !name) {
    redirect("/catalogo-tecnico?tab=sintomas&error=Categoria e nome do sintoma são obrigatórios.");
  }

  const slug = normalizeText(name).replace(/\s+/g, "-");

  const { data: createdRow, error } = await supabase
    .from("symptoms")
    .insert({
      equipment_category_id,
      name,
      slug,
      description,
      symptom_group,
    })
    .select("id, name")
    .single();

  if (error) {
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
  const test_group = readOptionalText(formData, "test_group");
  const description = readOptionalText(formData, "description");
  const default_unit = readOptionalText(formData, "default_unit");

  if (!name) {
    redirect("/catalogo-tecnico?tab=testes&error=Nome do teste é obrigatório.");
  }

  const slug = normalizeText(name).replace(/\s+/g, "-");

  const { data: createdRow, error } = await supabase
    .from("tests")
    .insert({
      name,
      slug,
      test_group,
      description,
      default_unit,
    })
    .select("id, name")
    .single();

  if (error) {
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
