-- Separa tokens lidos/gravados no cache do Claude (custam 0,1x / ~1,25x do preco
-- de entrada) para o custo registrado refletir o custo real.
alter table public.ai_token_logs
  add column if not exists cache_read_tokens integer not null default 0,
  add column if not exists cache_write_tokens integer not null default 0;
