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

export async function deleteTechnicianProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const profileId = String(formData.get("profile_id") ?? "").trim();

  if (!profileId) {
    redirect("/configuracoes?error=ID do perfil não fornecido.");
  }

  const { data: profile } = await supabase
    .from("technician_profiles")
    .select("id, user_id, display_name")
    .eq("id", profileId)
    .maybeSingle();

  if (!profile) {
    redirect("/configuracoes?error=Perfil não encontrado.");
  }

  if (profile.user_id === currentUser.id) {
    redirect("/configuracoes?error=Você não pode excluir o próprio perfil.");
  }

  const { count: assignedDiagnosticsCount } = await supabase
    .from("diagnostics")
    .select("id", { count: "exact", head: true })
    .eq("assigned_technician_id", profileId);

  if ((assignedDiagnosticsCount ?? 0) > 0) {
    redirect(
      "/configuracoes?error=Este técnico ainda está vinculado a diagnósticos atribuídos. Reatribua os casos antes de excluir o perfil.",
    );
  }

  const { data: deletedProfiles, error } = await supabase
    .from("technician_profiles")
    .delete()
    .select("id")
    .eq("id", profileId);

  if (error) {
    redirect(`/configuracoes?error=${encodeURIComponent(error.message)}`);
  }

  if (!deletedProfiles?.length) {
    redirect(
      "/configuracoes?error=O banco bloqueou a exclusão deste perfil. Verifique a policy de delete do technician_profiles no Supabase.",
    );
  }

  await supabase.from("change_history").insert({
    entity_type: "technician_profile",
    entity_id: profileId,
    change_type: "delete",
    field_name: "display_name",
    old_value_text: profile.display_name,
    change_reason: "Exclusão de perfil nas configurações",
    changed_by_user_id: currentUser.id,
  });

  revalidatePath("/configuracoes");
  redirect("/configuracoes?success=Perfil excluído com sucesso.");
}
