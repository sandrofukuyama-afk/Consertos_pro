"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function updateTechnicianProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const profileId = String(formData.get("profile_id") ?? "").trim();
  const specialties_summary = String(formData.get("specialties_summary") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const is_reviewer = formData.get("is_reviewer") === "on";

  if (!profileId) {
    redirect("/configuracoes?error=ID do perfil não fornecido.");
  }

  // Update the technician profile
  const { error } = await supabase
    .from("technician_profiles")
    .update({
      specialties_summary,
      notes,
      is_reviewer,
    })
    .eq("id", profileId);

  if (error) {
    redirect(`/configuracoes?error=${encodeURIComponent(error.message)}`);
  }

  // Record change history manually since it's a manual edit in settings
  await supabase.from("change_history").insert({
    entity_type: "technician_profile",
    entity_id: profileId,
    change_type: "update",
    field_name: "specialties/reviewer/notes",
    new_value_text: `specialties: ${specialties_summary}, reviewer: ${is_reviewer}`,
    change_reason: "Atualização de perfil nas configurações",
    changed_by_user_id: currentUser.id,
  });

  revalidatePath("/configuracoes");
  redirect("/configuracoes?success=Perfil atualizado com sucesso!");
}
