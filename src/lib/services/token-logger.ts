import { createClient } from "@/lib/supabase/server";

export async function logTokenUsage(
  model: string,
  purpose: string,
  promptTokens: number,
  completionTokens: number
) {
  try {
    const supabase = await createClient();

    // Cost estimation (USD per token)
    let inputCostPerToken = 0;
    let outputCostPerToken = 0;

    if (model === "gpt-4o-mini") {
      inputCostPerToken = 0.15 / 1000000;  // $0.15 per 1M tokens
      outputCostPerToken = 0.60 / 1000000; // $0.60 per 1M tokens
    } else if (model === "text-embedding-3-small") {
      inputCostPerToken = 0.02 / 1000000;  // $0.02 per 1M tokens
      outputCostPerToken = 0;
    }

    const estimatedCost = (promptTokens * inputCostPerToken) + (completionTokens * outputCostPerToken);
    const totalTokens = promptTokens + completionTokens;

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from("ai_token_logs").insert({
      model,
      purpose,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      user_id: user?.id || null,
    });
  } catch (error) {
    console.error("Failed to log token usage:", error);
  }
}
