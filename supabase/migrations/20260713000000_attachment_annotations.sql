alter table public.attachments
  add column annotations jsonb not null default '[]'::jsonb;
