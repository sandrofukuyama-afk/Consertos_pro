import { createClient } from "@/lib/supabase/server";
import type { CatalogOption } from "@/types/domain";

export async function getDiagnosticCatalog() {
  const supabase = await createClient();

  const [categoriesResult, manufacturersResult] = await Promise.all([
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
  ]);

  return {
    categories: (categoriesResult.data ?? []) as CatalogOption[],
    manufacturers: (manufacturersResult.data ?? []) as CatalogOption[],
  };
}
