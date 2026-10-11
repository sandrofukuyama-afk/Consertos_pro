import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, requireSupabaseEnv } from "@/lib/supabase/env";

// Cliente com a chave de servico: ignora o RLS. Use apenas em rotas de servidor
// que fazem a propria autorizacao (ex.: o bot do Telegram valida o usuario).
export function createSupabaseAdminClient() {
  const { url } = requireSupabaseEnv();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nao configurada.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
