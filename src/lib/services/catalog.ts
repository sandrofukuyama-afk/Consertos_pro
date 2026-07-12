import { createClient } from "@/lib/supabase/server";
import type { CatalogOption, EquipmentModelCatalogOption } from "@/types/domain";

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
    categories: categories.data ?? [],
    manufacturers: manufacturers.data ?? [],
    boardTypes: boardTypes.data ?? [],
    models: models.data ?? [],
    boards: boards.data ?? [],
    components: components.data ?? [],
    modelBoards: modelBoards.data ?? [],
    boardComponents: boardComponents.data ?? [],
  };
}

