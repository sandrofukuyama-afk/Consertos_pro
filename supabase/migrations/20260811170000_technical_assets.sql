create type public.technical_asset_type as enum (
  'boardview',
  'schematic_pdf',
  'datasheet',
  'firmware',
  'bios',
  'photo',
  'other'
);

create type public.technical_asset_file_format as enum (
  'brd',
  'bdv',
  'pdf',
  'bin',
  'zip',
  'jpg',
  'png',
  'other'
);

create type public.technical_asset_parser_status as enum (
  'pending',
  'parsed',
  'failed',
  'not_applicable'
);

create type public.technical_asset_text_status as enum (
  'pending',
  'extracted',
  'failed',
  'not_applicable'
);

create table public.technical_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type public.technical_asset_type not null,
  file_format public.technical_asset_file_format not null,
  original_filename text not null,
  storage_bucket text not null default 'technical-assets',
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  file_hash_sha256 text not null unique,
  mime_type text not null,
  parser_status public.technical_asset_parser_status not null default 'pending',
  extracted_text_status public.technical_asset_text_status not null default 'not_applicable',
  metadata jsonb not null default '{}'::jsonb,
  uploaded_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technical_assets_hash_check check (file_hash_sha256 ~ '^[0-9a-f]{64}$')
);

create table public.technical_asset_links (
  id uuid primary key default gen_random_uuid(),
  technical_asset_id uuid not null references public.technical_assets (id) on delete cascade,
  board_id uuid references public.boards (id) on delete cascade,
  equipment_model_id uuid references public.equipment_models (id) on delete cascade,
  linked_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technical_asset_links_context_check check (
    board_id is not null
    or equipment_model_id is not null
  )
);

create index idx_technical_assets_asset_type on public.technical_assets (asset_type);
create index idx_technical_assets_file_format on public.technical_assets (file_format);
create index idx_technical_assets_uploaded_by_user_id on public.technical_assets (uploaded_by_user_id);
create index idx_technical_asset_links_board_id on public.technical_asset_links (board_id);
create index idx_technical_asset_links_equipment_model_id on public.technical_asset_links (equipment_model_id);
create unique index idx_technical_asset_links_unique_context
on public.technical_asset_links (
  technical_asset_id,
  coalesce(board_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(equipment_model_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create trigger set_technical_assets_updated_at
before update on public.technical_assets
for each row execute function public.set_updated_at();

create trigger set_technical_asset_links_updated_at
before update on public.technical_asset_links
for each row execute function public.set_updated_at();

alter table public.technical_assets enable row level security;
alter table public.technical_asset_links enable row level security;

create policy "technical_assets_select_authenticated"
on public.technical_assets
for select
to authenticated
using (public.is_active_authenticated_user());

create policy "technical_assets_insert_authenticated"
on public.technical_assets
for insert
to authenticated
with check (public.is_active_authenticated_user());

create policy "technical_assets_update_authenticated"
on public.technical_assets
for update
to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

create policy "technical_assets_delete_authenticated"
on public.technical_assets
for delete
to authenticated
using (public.is_active_authenticated_user());

create policy "technical_asset_links_select_authenticated"
on public.technical_asset_links
for select
to authenticated
using (public.is_active_authenticated_user());

create policy "technical_asset_links_insert_authenticated"
on public.technical_asset_links
for insert
to authenticated
with check (public.is_active_authenticated_user());

create policy "technical_asset_links_update_authenticated"
on public.technical_asset_links
for update
to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

create policy "technical_asset_links_delete_authenticated"
on public.technical_asset_links
for delete
to authenticated
using (public.is_active_authenticated_user());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'technical-assets',
  'technical-assets',
  false,
  209715200,
  array[
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_select_technical_assets_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'technical-assets'
  and public.is_active_authenticated_user()
);

create policy "storage_insert_technical_assets_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'technical-assets'
  and public.is_active_authenticated_user()
);

create policy "storage_update_technical_assets_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'technical-assets'
  and public.is_active_authenticated_user()
)
with check (
  bucket_id = 'technical-assets'
  and public.is_active_authenticated_user()
);

create policy "storage_delete_technical_assets_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'technical-assets'
  and public.is_active_authenticated_user()
);
