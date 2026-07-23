import { createClient } from "@/lib/supabase/server";
import type { CatalogOption, EquipmentModelCatalogOption } from "@/types/domain";

type CategoryRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
};

type ManufacturerRow = {
  id: string;
  name: string;
  country: string | null;
  notes: string | null;
};

type BoardTypeRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
};

type EquipmentModelRow = {
  id: string;
  model_name: string;
  family_name: string | null;
  revision_label: string | null;
  manufacturers: { name: string | null } | null;
  equipment_categories: { name: string | null } | null;
};

type BoardRow = {
  id: string;
  board_code: string;
  board_revision: string | null;
  description: string | null;
  board_types: { name: string | null } | null;
  manufacturers: { name: string | null } | null;
};

type ComponentRow = {
  id: string;
  component_ref: string;
  component_type: string;
  manufacturer_part_number: string | null;
  generic_part_number: string | null;
  package_type: string | null;
  description: string | null;
};

type SymptomRow = {
  id: string;
  name: string;
  symptom_group: string | null;
  description: string | null;
  equipment_categories: { name: string | null } | null;
};

type TestRow = {
  id: string;
  name: string;
  test_group: string | null;
  default_unit: string | null;
  description: string | null;
};

type ModelBoardRow = {
  id: string;
  role_label: string;
  is_primary: boolean;
  notes: string | null;
  equipment_models: { model_name: string | null } | null;
  boards: { board_code: string | null } | null;
};

type BoardComponentRow = {
  id: string;
  reference_designator: string;
  circuit_function: string | null;
  expected_behavior: string | null;
  is_critical: boolean;
  boards: { board_code: string | null } | null;
  components:
    | {
        component_ref: string | null;
        component_type: string | null;
      }
    | null;
};

export async function getDiagnosticCatalog() {
  const supabase = await createClient();

  const [categoriesResult, manufacturersResult, modelsResult] = await Promise.all([
    supabase
      .from("equipment_categories")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("manufacturers")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("equipment_models")
      .select("id, model_name, manufacturer_id, equipment_category_id")
      .eq("is_active", true)
      .order("model_name"),
  ]);

  return {
    categories: (categoriesResult.data ?? []) as CatalogOption[],
    manufacturers: (manufacturersResult.data ?? []) as CatalogOption[],
    models: (modelsResult.data ?? []).map((item) => ({
      id: item.id,
      name: item.model_name,
      manufacturerId: item.manufacturer_id,
      categoryId: item.equipment_category_id,
    })) as EquipmentModelCatalogOption[],
  };
}

export async function getLibraryCatalog() {
  const supabase = await createClient();

  const [diagnosticCatalog, boardsResult, componentsResult] = await Promise.all([
    getDiagnosticCatalog(),
    supabase.from("boards").select("id, board_code").eq("is_active", true).order("board_code"),
    supabase.from("components").select("id, component_ref").eq("is_active", true).order("component_ref"),
  ]);

  return {
    ...diagnosticCatalog,
    boards: (boardsResult.data ?? []).map((item) => ({ id: item.id, name: item.board_code })),
    components: (componentsResult.data ?? []).map((item) => ({ id: item.id, name: item.component_ref })),
  };
}

export async function getCatalogDashboardData() {
  const supabase = await createClient();

  const [
    categories,
    manufacturers,
    boardTypes,
    models,
    boards,
    components,
    symptoms,
    tests,
    modelBoards,
    boardComponents,
  ] = await Promise.all([
    supabase.from("equipment_categories").select("*").eq("is_active", true).order("name"),
    supabase.from("manufacturers").select("*").eq("is_active", true).order("name"),
    supabase.from("board_types").select("*").order("name"),
    supabase
      .from("equipment_models")
      .select(`
        *,
        manufacturers(name),
        equipment_categories(name)
      `)
      .eq("is_active", true)
      .order("model_name"),
    supabase
      .from("boards")
      .select(`
        *,
        board_types(name),
        manufacturers(name)
      `)
      .eq("is_active", true)
      .order("board_code"),
    supabase.from("components").select("*").eq("is_active", true).order("component_ref"),
    supabase
      .from("symptoms")
      .select(`
        *,
        equipment_categories(name)
      `)
      .eq("is_active", true)
      .order("name"),
    supabase.from("tests").select("*").eq("is_active", true).order("name"),
    supabase
      .from("model_boards")
      .select(`
        *,
        equipment_models(model_name),
        boards(board_code)
      `)
      .order("created_at", { ascending: false }),
    supabase
      .from("board_components")
      .select(`
        *,
        boards(board_code),
        components(component_ref, component_type)
      `)
      .order("created_at", { ascending: false }),
  ]);

  return {
    categories: (categories.data ?? []) as CategoryRow[],
    manufacturers: (manufacturers.data ?? []) as ManufacturerRow[],
    boardTypes: (boardTypes.data ?? []) as BoardTypeRow[],
    models: (models.data ?? []) as EquipmentModelRow[],
    boards: (boards.data ?? []) as BoardRow[],
    components: (components.data ?? []) as ComponentRow[],
    symptoms: (symptoms.data ?? []) as SymptomRow[],
    tests: (tests.data ?? []) as TestRow[],
    modelBoards: (modelBoards.data ?? []) as ModelBoardRow[],
    boardComponents: (boardComponents.data ?? []) as BoardComponentRow[],
  };
}

