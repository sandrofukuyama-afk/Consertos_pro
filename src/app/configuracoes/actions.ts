"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { mapSupabaseAuthErrorMessage } from "@/lib/auth-messages";
import { requireSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function createIsolatedSupabaseClient() {
  const { url, publishableKey } = requireSupabaseEnv();

  return createSupabaseClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function waitForCreatedProfile(email: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: createdUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (createdUser) {
      const { data: createdProfile } = await supabase
        .from("technician_profiles")
        .select("id")
        .eq("user_id", createdUser.id)
        .maybeSingle();

      if (createdProfile) {
        return createdProfile;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return null;
}

export async function createTechnicianAccessAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();
  const isolatedSupabase = createIsolatedSupabaseClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const specialtiesSummary = String(formData.get("specialties_summary") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReviewer = formData.get("is_reviewer") === "on";

  if (!fullName || !email || password.length < 6) {
    redirect(
      "/configuracoes?tab=tecnicos&error=Preencha nome, e-mail e uma senha com pelo menos 6 caracteres.",
    );
  }

  const { error: signUpError } = await isolatedSupabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        name: fullName,
      },
    },
  });

  if (signUpError) {
    redirect(
      `/configuracoes?tab=tecnicos&error=${encodeURIComponent(mapSupabaseAuthErrorMessage(signUpError.message))}`,
    );
  }

  const createdProfile = await waitForCreatedProfile(email, supabase);

  if (createdProfile) {
    const { error: profileUpdateError } = await supabase
      .from("technician_profiles")
      .update({
        specialties_summary: specialtiesSummary,
        notes,
        is_reviewer: isReviewer,
      })
      .eq("id", createdProfile.id);

    if (profileUpdateError) {
      redirect(
        "/configuracoes?tab=tecnicos&error=A conta foi criada, mas o banco bloqueou a configuração inicial do perfil técnico. Ajuste a policy de update do technician_profiles e tente editar o perfil novamente.",
      );
    }

    await supabase.from("change_history").insert({
      entity_type: "technician_profile",
      entity_id: createdProfile.id,
      change_type: "create",
      field_name: "all",
      new_value_text: `display_name: ${fullName}, reviewer: ${isReviewer}`,
      change_reason: "Cadastro interno de técnico nas configurações",
      changed_by_user_id: currentUser.id,
    });
  }

  revalidatePath("/configuracoes");
  redirect(
    "/configuracoes?tab=tecnicos&success=Novo usuário criado. Peça para o técnico confirmar o e-mail antes do primeiro login.",
  );
}

export async function updateTechnicianProfileAction(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const supabase = await createClient();

  const profileId = String(formData.get("profile_id") ?? "").trim();
  const specialtiesSummary = String(formData.get("specialties_summary") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReviewer = formData.get("is_reviewer") === "on";

  if (!profileId) {
    redirect("/configuracoes?error=ID do perfil não fornecido.");
  }

  const { error } = await supabase
    .from("technician_profiles")
    .update({
      specialties_summary: specialtiesSummary,
      notes,
      is_reviewer: isReviewer,
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
    new_value_text: `specialties: ${specialtiesSummary}, reviewer: ${isReviewer}`,
    change_reason: "Atualização de perfil nas configurações",
    changed_by_user_id: currentUser.id,
  });

  revalidatePath("/configuracoes");
  redirect("/configuracoes?success=Perfil atualizado com sucesso.");
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
