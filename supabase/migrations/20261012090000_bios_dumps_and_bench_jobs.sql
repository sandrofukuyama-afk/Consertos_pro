-- Dumps de BIOS por diagnostico e fila de trabalhos do agente de bancada
-- (leitura/gravacao de chips SPI com gravador USB).

create table public.diagnostic_bios_dumps (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  -- original: lido antes de qualquer reparo; backup: lido logo antes de uma gravacao;
  -- gravado: conteudo que foi gravado; verificado: lido depois de gravar; enviado: upload manual.
  kind text not null check (kind in ('original', 'backup', 'gravado', 'verificado', 'enviado')),
  file_name text not null,
  storage_bucket text not null default 'technical-assets',
  storage_path text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  file_hash_sha256 text not null check (file_hash_sha256 ~ '^[0-9a-f]{64}$'),
  chip_name text,
  programmer text,
  source text not null default 'upload' check (source in ('upload', 'agente')),
  analysis jsonb not null default '{}'::jsonb,
  notes text,
  bench_job_id uuid,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default timezone('utc', now())
);

create index idx_diagnostic_bios_dumps_diagnostic on public.diagnostic_bios_dumps (diagnostic_id, created_at desc);
create index idx_diagnostic_bios_dumps_hash on public.diagnostic_bios_dumps (file_hash_sha256);

create table public.bench_jobs (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  kind text not null check (kind in ('read', 'write')),
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'running', 'done', 'failed', 'cancelled')),
  -- write: { source: 'dump' | 'asset', source_id, file_name, sha256 }
  params jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  progress text,
  error text,
  agent_name text,
  requested_by_user_id uuid references public.users (id),
  -- Gravacao so e entregue ao agente depois da confirmacao explicita do tecnico.
  confirmed_at timestamptz,
  claimed_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bench_jobs_write_needs_source check (kind <> 'write' or params ? 'source_id')
);

create index idx_bench_jobs_queue on public.bench_jobs (status, created_at);
create index idx_bench_jobs_diagnostic on public.bench_jobs (diagnostic_id, created_at desc);

alter table public.diagnostic_bios_dumps
  add constraint diagnostic_bios_dumps_bench_job_fk
  foreign key (bench_job_id) references public.bench_jobs (id) on delete set null;

create trigger set_bench_jobs_updated_at
before update on public.bench_jobs
for each row execute function public.set_updated_at();

alter table public.diagnostic_bios_dumps enable row level security;
alter table public.bench_jobs enable row level security;

create policy "bios_dumps_select" on public.diagnostic_bios_dumps
  for select to authenticated using (public.is_active_authenticated_user());
create policy "bios_dumps_insert" on public.diagnostic_bios_dumps
  for insert to authenticated with check (public.is_active_authenticated_user());
create policy "bios_dumps_update" on public.diagnostic_bios_dumps
  for update to authenticated using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());
create policy "bios_dumps_delete" on public.diagnostic_bios_dumps
  for delete to authenticated using (public.is_active_authenticated_user());

create policy "bench_jobs_select" on public.bench_jobs
  for select to authenticated using (public.is_active_authenticated_user());
create policy "bench_jobs_insert" on public.bench_jobs
  for insert to authenticated with check (public.is_active_authenticated_user());
create policy "bench_jobs_update" on public.bench_jobs
  for update to authenticated using (public.is_active_authenticated_user())
  with check (public.is_active_authenticated_user());

-- Agentes de bancada: ultimo contato, para o app mostrar se estao online.
create table public.bench_agents (
  name text primary key,
  last_seen_at timestamptz not null default timezone('utc', now()),
  info jsonb not null default '{}'::jsonb
);

alter table public.bench_agents enable row level security;

create policy "bench_agents_select" on public.bench_agents
  for select to authenticated using (public.is_active_authenticated_user());

-- "lido": leituras seguintes a primeira (a primeira do caso e a "original").
alter table public.diagnostic_bios_dumps drop constraint diagnostic_bios_dumps_kind_check;
alter table public.diagnostic_bios_dumps add constraint diagnostic_bios_dumps_kind_check
  check (kind in ('original', 'lido', 'backup', 'gravado', 'verificado', 'enviado'));
