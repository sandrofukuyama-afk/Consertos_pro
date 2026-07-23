import { createClient } from "@/lib/supabase/server";

type SettingsProfile = {
  id: string;
  display_name: string;
  specialties_summary: string | null;
  notes: string | null;
  is_reviewer: boolean;
  users: {
    full_name: string | null;
    email: string | null;
    status: string | null;
  } | null;
};

type ChangeHistoryEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  change_type: string;
  field_name: string | null;
  new_value_text: string | null;
  change_reason: string | null;
  changed_at: string;
  users: { full_name: string | null } | null;
};

type EntityReviewEntry = {
  id: string;
  entity_type: string;
  entity_id: string;
  review_status: string;
  review_notes: string | null;
  reviewed_at: string;
  users: { full_name: string | null } | null;
};

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
    profiles: (profilesResult.data ?? []) as SettingsProfile[],
    history: (historyResult.data ?? []) as ChangeHistoryEntry[],
    reviews: (reviewsResult.data ?? []) as EntityReviewEntry[],
  };
}
