-- Migration: Create AI Token Logs table for tracking costs
create table if not exists public.ai_token_logs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  model text not null,
  purpose text not null,
  prompt_tokens integer not null,
  completion_tokens integer not null,
  total_tokens integer not null,
  estimated_cost_usd numeric(12, 8) not null,
  user_id uuid references auth.users(id) on delete set null
);

-- Enable RLS
alter table public.ai_token_logs enable row level security;

-- Policies
create policy "Allow all authenticated users to read token logs"
  on public.ai_token_logs for select
  to authenticated
  using (true);

create policy "Allow insertion of token logs by authenticated users"
  on public.ai_token_logs for insert
  to authenticated
  with check (true);
