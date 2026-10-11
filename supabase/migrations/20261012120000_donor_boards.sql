-- Placas doadoras (sucata) e indice de texto dos esquemas para localizar componentes.

create extension if not exists pg_trgm with schema extensions;

create sequence public.donor_board_number_seq;

create table public.donor_boards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('D-' || lpad(nextval('public.donor_board_number_seq')::text, 4, '0')),
  board_id uuid references public.boards (id) on delete set null,
  equipment_model_id uuid references public.equipment_models (id) on delete set null,
  board_code_text text,
  title text,
  notes text,
  photo_paths jsonb not null default '[]'::jsonb,
  ai_markings text,
  index_status text not null default 'pendente'
    check (index_status in ('pendente', 'indexada', 'sem_esquema', 'erro')),
  index_detail text,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Marcacoes lidas nas fotos das placas doadoras (source = foto).
create table public.donor_board_index (
  id uuid primary key default gen_random_uuid(),
  donor_board_id uuid not null references public.donor_boards (id) on delete cascade,
  source text not null check (source in ('esquema', 'foto')),
  technical_asset_id uuid references public.technical_assets (id) on delete set null,
  page integer,
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_donor_board_index_donor on public.donor_board_index (donor_board_id);
create index idx_donor_board_index_content_trgm on public.donor_board_index
  using gin (content extensions.gin_trgm_ops);

create trigger set_donor_boards_updated_at
before update on public.donor_boards
for each row execute function public.set_updated_at();

-- Texto de cada pagina dos esquemas em PDF (indexado sob demanda).
create table public.schematic_page_texts (
  technical_asset_id uuid not null references public.technical_assets (id) on delete cascade,
  page integer not null,
  content text not null,
  primary key (technical_asset_id, page)
);

create index idx_schematic_page_texts_trgm on public.schematic_page_texts
  using gin (content extensions.gin_trgm_ops);

alter table public.donor_boards enable row level security;
alter table public.donor_board_index enable row level security;
alter table public.schematic_page_texts enable row level security;

create policy "donor_boards_all" on public.donor_boards
  for all to authenticated using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());
create policy "donor_board_index_all" on public.donor_board_index
  for all to authenticated using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());
create policy "schematic_page_texts_all" on public.schematic_page_texts
  for all to authenticated using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());
