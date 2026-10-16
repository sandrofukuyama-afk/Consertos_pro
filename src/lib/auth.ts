import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/types/domain";

/**
 * Sessao atual. `blockedEmail` vem preenchido quando ha login mas a conta nao
 * esta ativa: o banco (RLS) esconde o perfil e todos os dados dessa conta, e
 * antes o app deixava entrar com a tela vazia — parecia que os casos sumiram.
 */
async function loadCurrentUser(): Promise<{ user: AppUser | null; blockedEmail: string | null }> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { user: null, blockedEmail: null };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, auth_user_id, full_name, email")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();

  // O perfil e criado junto com a conta; so some da consulta se a conta nao
  // estiver ativa (bloqueada ou aguardando liberacao).
  if (!profile) {
    return { user: null, blockedEmail: authUser.email ?? "esta conta" };
  }

  return {
    user: {
      id: profile.id,
      authUserId: profile.auth_user_id,
      fullName: profile.full_name,
      email: profile.email,
    },
    blockedEmail: null,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  return (await loadCurrentUser()).user;
}

export async function requireCurrentUser() {
  const { user, blockedEmail } = await loadCurrentUser();

  if (!user) {
    redirect(
      blockedEmail
        ? `/login?error=${encodeURIComponent(
            `A conta ${blockedEmail} está bloqueada ou sem acesso, por isso não via nenhum caso. Entre com a conta ativa da oficina.`,
          )}`
        : "/login",
    );
  }

  return user;
}
