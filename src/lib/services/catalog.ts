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
  return getDiagnosticCatalog();
}
