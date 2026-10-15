-- Conversa completa do chat de cada caso, no formato da API da Anthropic:
-- mensagens, consultas feitas pela IA (boardview, esquema, web) e seus
-- resultados, raciocinio e blocos de compactacao. E reenviada inteira a cada
-- mensagem (com cache), para a IA nao esquecer o que ja apurou.
-- So cresce: nunca editar mensagens antigas (quebra cache e raciocinio salvo).
create table if not exists public.diagnostic_chat_threads (
  diagnostic_id uuid primary key references public.diagnostics (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  -- Assinatura do ultimo "estado do caso" enviado; so reenvia quando muda.
  case_brief_hash text,
  updated_at timestamptz not null default now()
);

alter table public.diagnostic_chat_threads enable row level security;

create policy diagnostic_chat_threads_select_authenticated on public.diagnostic_chat_threads
  for select to authenticated using (public.is_active_authenticated_user());
create policy diagnostic_chat_threads_insert_authenticated on public.diagnostic_chat_threads
  for insert to authenticated with check (public.is_active_authenticated_user());
create policy diagnostic_chat_threads_update_authenticated on public.diagnostic_chat_threads
  for update to authenticated
  using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());
create policy diagnostic_chat_threads_delete_authenticated on public.diagnostic_chat_threads
  for delete to authenticated using (public.is_active_authenticated_user());
