import { createClient } from "@/lib/supabase/server";

// Precos em USD por 1 milhao de tokens [entrada, saida]. O mais especifico vem primeiro.
const PRICES: Array<[RegExp, number, number]> = [
  [/^gpt-4o-mini/, 0.15, 0.6],
  [/^text-embedding-3-small/, 0.02, 0],
  [/^claude-fable/, 10, 50],
  [/^claude-opus-5-5/, 4, 20],
  [/^claude-opus/, 5, 25],
  [/^claude-sonnet-5/, 2, 10],
  [/^claude-sonnet/, 3, 15],
  [/^claude-haiku-5-5/, 0.1, 0.5],
  [/^claude-haiku/, 1, 5],
];

// Cache do Claude: leitura custa 10% da entrada; gravacao ~125% (5 min) a 200% (1 h).
const CACHE_READ_FACTOR = 0.1;
const CACHE_WRITE_FACTOR = 1.25;

export async function logTokenUsage(
  model: string,
  purpose: string,
  promptTokens: number,
  completionTokens: number,
  cache: { cacheReadTokens?: number; cacheWriteTokens?: number } = {},
) {
  try {
    const supabase = await createClient();
    const [, inputPerMillion, outputPerMillion] = PRICES.find(([pattern]) => pattern.test(model)) ?? [null, 0, 0];
    const cacheRead = cache.cacheReadTokens ?? 0;
    const cacheWrite = cache.cacheWriteTokens ?? 0;

    const estimatedCost =
      (promptTokens * inputPerMillion +
        cacheRead * inputPerMillion * CACHE_READ_FACTOR +
        cacheWrite * inputPerMillion * CACHE_WRITE_FACTOR +
        completionTokens * outputPerMillion) /
      1_000_000;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("ai_token_logs").insert({
      model,
      purpose,
      // prompt_tokens = entrada sem cache; o total inclui o que veio do cache.
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cache_read_tokens: cacheRead,
      cache_write_tokens: cacheWrite,
      total_tokens: promptTokens + cacheRead + cacheWrite + completionTokens,
      estimated_cost_usd: estimatedCost,
      user_id: user?.id || null,
    });
  } catch (error) {
    console.error("Failed to log token usage:", error);
  }
}
