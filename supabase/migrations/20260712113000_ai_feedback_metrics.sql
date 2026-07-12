create type public.ai_feedback_rating as enum (
  'helpful',
  'partially_helpful',
  'not_helpful'
);

create table public.ai_response_feedback (
  id uuid primary key default gen_random_uuid(),
  ai_response_id uuid not null unique references public.ai_responses (id) on delete cascade,
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  feedback_rating public.ai_feedback_rating not null,
  was_followed boolean,
  note text,
  submitted_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index idx_ai_response_feedback_response_id
on public.ai_response_feedback (ai_response_id);

create index idx_ai_response_feedback_diagnostic_id
on public.ai_response_feedback (diagnostic_id);

create trigger set_ai_response_feedback_updated_at
before update on public.ai_response_feedback
for each row execute function public.set_updated_at();

alter table public.ai_response_feedback enable row level security;

create policy "ai_response_feedback_select_authenticated"
on public.ai_response_feedback
for select
to authenticated
using (true);

create policy "ai_response_feedback_insert_authenticated"
on public.ai_response_feedback
for insert
to authenticated
with check (true);

create policy "ai_response_feedback_update_authenticated"
on public.ai_response_feedback
for update
to authenticated
using (true)
with check (true);

create policy "ai_response_feedback_delete_authenticated"
on public.ai_response_feedback
for delete
to authenticated
using (true);
