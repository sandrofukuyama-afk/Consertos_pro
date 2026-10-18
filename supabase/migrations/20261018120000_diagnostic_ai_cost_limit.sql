-- Limite de gasto da IA por caso (US$). Vazio = usa o limite padrao do app
-- (DEFAULT_CHAT_COST_LIMIT_USD em src/lib/utils.ts). So avisa, nao bloqueia.
alter table public.diagnostics
  add column if not exists ai_cost_limit_usd numeric(8, 2)
    check (ai_cost_limit_usd is null or ai_cost_limit_usd > 0);
