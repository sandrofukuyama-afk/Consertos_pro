import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/domain";

export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, auth_user_id, full_name, email")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: authUser.id,
      authUserId: authUser.id,
      fullName:
        authUser.user_metadata.full_name ??
        authUser.user_metadata.name ??
        authUser.email?.split("@")[0] ??
        "Tecnico",
      email: authUser.email ?? "",
    };
  }

  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    fullName: profile.full_name,
    email: profile.email,
  };
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
