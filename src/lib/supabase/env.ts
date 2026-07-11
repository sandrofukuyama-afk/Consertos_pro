const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export function getSupabaseEnv() {
  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

export function requireSupabaseEnv() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase environment variables are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }

  return {
    url: supabaseUrl,
    publishableKey: supabasePublishableKey,
  };
}
