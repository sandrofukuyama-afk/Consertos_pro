alter table public.diagnostics
add column if not exists equipment_details jsonb not null default '{}'::jsonb;
