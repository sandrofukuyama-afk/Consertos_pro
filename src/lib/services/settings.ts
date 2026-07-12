import { createClient } from "@/lib/supabase/server";

export async function getSettingsDashboardData() {
  const supabase = await createClient();

  const [profilesResult, historyResult, reviewsResult] = await Promise.all([
    supabase
      .from("technician_profiles")
      .select(`
        *,
        users (
          full_name,
          email,
          status
        )
      `)
      .order("display_name"),
    supabase
      .from("change_history")
      .select(`
        *,
        users (
          full_name
        )
      `)
      .order("changed_at", { ascending: false })
      .limit(50),
    supabase
      .from("entity_reviews")
      .select(`
        *,
        users (
          full_name
        )
      `)
      .order("reviewed_at", { ascending: false })
      .limit(25),
  ]);

  return {
    profiles: profilesResult.data ?? [],
    history: historyResult.data ?? [],
    reviews: reviewsResult.data ?? [],
  };
}
