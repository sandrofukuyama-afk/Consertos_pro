-- Create board_measurements table for reference values
create table public.board_measurements (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  component_ref text not null,
  measurement_point text not null,
  expected_value text not null,
  condition text not null default 'power_off',
  notes text,
  created_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now())
);

-- Enable Row Level Security
alter table public.board_measurements enable row level security;

-- Add RLS policy for authenticated users
create policy "Allow all operations for authenticated users on board_measurements"
  on public.board_measurements for all
  to authenticated
  using (true)
  with check (true);
