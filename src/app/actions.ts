"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/");
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/login?message=Conta criada. Agora faca login.");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createDiagnosticAction(formData: FormData) {
  const user = await requireCurrentUser();
  const supabase = await createClient();

  const categoryId = String(formData.get("equipment_category_id") ?? "");
  const manufacturerId =
    String(formData.get("manufacturer_id") ?? "").trim() || null;
  const equipmentLabel = String(formData.get("equipment_label") ?? "").trim();
  const problemReport = String(formData.get("initial_problem_report") ?? "").trim();
  const physicalNotes =
    String(formData.get("physical_condition_notes") ?? "").trim() || null;

  if (!categoryId || !problemReport) {
    redirect(
      "/diagnosticos/novo?error=Categoria e relato inicial sao obrigatorios.",
    );
  }

  const { error } = await supabase.from("diagnostics").insert({
    equipment_category_id: categoryId,
    manufacturer_id: manufacturerId,
    opened_by_user_id: user.id,
    status: "active",
    priority: "normal",
    equipment_label: equipmentLabel || null,
    initial_problem_report: problemReport,
    physical_condition_notes: physicalNotes,
    current_summary: problemReport,
  });

  if (error) {
    redirect(`/diagnosticos/novo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/");
  redirect("/?message=Diagnostico criado com sucesso.");
}
