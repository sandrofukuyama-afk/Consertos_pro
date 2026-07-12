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
  await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const slug = normalizeText(name).replace(/\s+/g, "-");
  const description = readOptionalText(formData, "description");

  if (!name) {
    redirect("/catalogo-tecnico?tab=categorias&error=Nome é obrigatório.");
  }

  const { error } = await supabase.from("equipment_categories").insert({
    name,
    slug,
    description,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=categorias&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=categorias&success=Categoria criada com sucesso!");
}

export async function createManufacturerAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const name = String(formData.get("name") ?? "").trim();
  const normalized_name = normalizeText(name);
  const country = readOptionalText(formData, "country");
  const notes = readOptionalText(formData, "notes");

  if (!name) {
    redirect("/catalogo-tecnico?tab=fabricantes&error=Nome é obrigatório.");
  }

  const { error } = await supabase.from("manufacturers").insert({
    name,
    normalized_name,
    country,
    notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=fabricantes&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=fabricantes&success=Fabricante criado com sucesso!");
}

export async function createModelAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const manufacturer_id = String(formData.get("manufacturer_id") ?? "").trim();
  const equipment_category_id = String(formData.get("equipment_category_id") ?? "").trim();
  const model_name = String(formData.get("model_name") ?? "").trim();
  const family_name = readOptionalText(formData, "family_name");
  const revision_label = readOptionalText(formData, "revision_label");
  const release_notes = readOptionalText(formData, "release_notes");

  if (!manufacturer_id || !equipment_category_id || !model_name) {
    redirect("/catalogo-tecnico?tab=modelos&error=Fabricante, Categoria e Nome do modelo são obrigatórios.");
  }

  const normalized_model_name = normalizeText(model_name);

  const { error } = await supabase.from("equipment_models").insert({
    manufacturer_id,
    equipment_category_id,
    model_name,
    normalized_model_name,
    family_name,
    revision_label,
    release_notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=modelos&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=modelos&success=Modelo criado com sucesso!");
}

export async function createBoardAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const board_type_id = String(formData.get("board_type_id") ?? "").trim();
  const manufacturer_id = readOptionalText(formData, "manufacturer_id");
  const board_code = String(formData.get("board_code") ?? "").trim();
  const board_revision = readOptionalText(formData, "board_revision");
  const description = readOptionalText(formData, "description");
  const notes = readOptionalText(formData, "notes");

  if (!board_type_id || !board_code) {
    redirect("/catalogo-tecnico?tab=placas&error=Tipo de placa e Código da placa são obrigatórios.");
  }

  const { error } = await supabase.from("boards").insert({
    board_type_id,
    manufacturer_id,
    board_code,
    board_revision,
    description,
    notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=placas&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=placas&success=Placa criada com sucesso!");
}

export async function createComponentAction(formData: FormData) {
  await requireCurrentUser();
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
    redirect("/catalogo-tecnico?tab=componentes&error=Referência e Tipo de componente são obrigatórios.");
  }

  const { error } = await supabase.from("components").insert({
    component_ref,
    component_type,
    manufacturer_part_number,
    generic_part_number,
    description,
    package_type,
    datasheet_summary,
    notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=componentes&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=componentes&success=Componente criado com sucesso!");
}

export async function createModelBoardAction(formData: FormData) {
  await requireCurrentUser();
  const supabase = await createClient();

  const equipment_model_id = String(formData.get("equipment_model_id") ?? "").trim();
  const board_id = String(formData.get("board_id") ?? "").trim();
  const role_label = String(formData.get("role_label") ?? "").trim();
  const is_primary = formData.get("is_primary") === "on";
  const notes = readOptionalText(formData, "notes");

  if (!equipment_model_id || !board_id || !role_label) {
    redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&error=Modelo, Placa e Função são obrigatórios.");
  }

  const { error } = await supabase.from("model_boards").insert({
    equipment_model_id,
    board_id,
    role_label,
    is_primary,
    notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=vinculos-modelo-placa&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=vinculos-modelo-placa&success=Vínculo entre Modelo e Placa criado com sucesso!");
}

export async function createBoardComponentAction(formData: FormData) {
  await requireCurrentUser();
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
    redirect("/catalogo-tecnico?tab=componentes-placa&error=Placa, Componente e Designador de referência (ex: U3201) são obrigatórios.");
  }

  const { error } = await supabase.from("board_components").insert({
    board_id,
    component_id,
    reference_designator,
    circuit_function,
    expected_behavior,
    location_notes,
    is_critical,
    notes,
  });

  if (error) {
    redirect(`/catalogo-tecnico?tab=componentes-placa&error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/catalogo-tecnico");
  redirect("/catalogo-tecnico?tab=componentes-placa&success=Componente vinculado à placa com sucesso!");
}
