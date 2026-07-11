set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create type public.user_status as enum ('active', 'inactive', 'blocked');
create type public.diagnostic_status as enum (
  'draft',
  'active',
  'waiting_input',
  'resolved',
  'unresolved',
  'archived'
);
create type public.diagnostic_priority as enum ('low', 'normal', 'high', 'critical');
create type public.document_type as enum (
  'schematic',
  'service_manual',
  'boardview',
  'datasheet',
  'firmware',
  'bios',
  'technical_note',
  'voltage_map'
);
create type public.diagnostic_source_type as enum (
  'technician',
  'ai',
  'extracted_text',
  'intake'
);
create type public.test_result_status as enum (
  'pending',
  'passed',
  'failed',
  'inconclusive',
  'not_applicable'
);
create type public.measurement_type as enum (
  'voltage',
  'current',
  'resistance',
  'temperature',
  'consumption',
  'frequency',
  'continuity',
  'other'
);
create type public.hypothesis_status as enum (
  'open',
  'strengthened',
  'weakened',
  'discarded',
  'confirmed'
);
create type public.hypothesis_created_by_type as enum ('technician', 'ai', 'system');
create type public.attachment_type as enum (
  'photo',
  'video',
  'screenshot',
  'waveform',
  'report'
);
create type public.resolved_case_status as enum ('confirmed', 'probable', 'unresolved');
create type public.confirmed_cause_type as enum (
  'component_failure',
  'short_circuit',
  'bad_solder',
  'firmware_corruption',
  'line_missing',
  'liquid_damage',
  'thermal_failure',
  'other'
);
create type public.applied_solution_type as enum (
  'component_replacement',
  'rework',
  'firmware_flash',
  'jumper',
  'cleaning',
  'reballing',
  'configuration_change',
  'other'
);
create type public.embedding_source_type as enum (
  'diagnostic',
  'ai_response',
  'technical_document',
  'resolved_case',
  'component',
  'model'
);
create type public.embedding_content_role as enum (
  'summary',
  'diagnosis_context',
  'solution_summary',
  'document_chunk'
);
create type public.change_type as enum (
  'create',
  'update',
  'delete',
  'status_change',
  'merge',
  'restore'
);
create type public.review_status as enum (
  'pending',
  'approved',
  'rejected',
  'needs_revision'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_auth_user_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    split_part(new.email, '@', 1)
  );

  insert into public.users (
    auth_user_id,
    full_name,
    email,
    status,
    last_login_at
  )
  values (
    new.id,
    resolved_name,
    new.email,
    'active',
    new.last_sign_in_at
  )
  on conflict (auth_user_id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        last_login_at = excluded.last_login_at,
        updated_at = timezone('utc', now());

  insert into public.technician_profiles (
    user_id,
    display_name
  )
  select u.id, resolved_name
  from public.users u
  where u.auth_user_id = new.id
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null unique,
  status public.user_status not null default 'active',
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.technician_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  display_name text not null,
  specialties_summary text,
  notes text,
  is_reviewer boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.equipment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.manufacturers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null unique,
  country text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.equipment_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid not null references public.manufacturers (id),
  equipment_category_id uuid not null references public.equipment_categories (id),
  model_name text not null,
  normalized_model_name text not null,
  family_name text,
  revision_label text,
  release_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (manufacturer_id, normalized_model_name)
);

create table public.board_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  board_type_id uuid not null references public.board_types (id),
  manufacturer_id uuid references public.manufacturers (id),
  board_code text not null,
  board_revision text,
  description text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.model_boards (
  id uuid primary key default gen_random_uuid(),
  equipment_model_id uuid not null references public.equipment_models (id) on delete cascade,
  board_id uuid not null references public.boards (id) on delete cascade,
  role_label text not null,
  is_primary boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (equipment_model_id, board_id, role_label)
);

create table public.components (
  id uuid primary key default gen_random_uuid(),
  component_ref text not null,
  component_type text not null,
  manufacturer_part_number text,
  generic_part_number text,
  description text,
  package_type text,
  datasheet_summary text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.board_components (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards (id) on delete cascade,
  component_id uuid not null references public.components (id),
  reference_designator text not null,
  circuit_function text,
  expected_behavior text,
  location_notes text,
  is_critical boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (board_id, reference_designator)
);

create table public.technical_documents (
  id uuid primary key default gen_random_uuid(),
  manufacturer_id uuid references public.manufacturers (id),
  equipment_model_id uuid references public.equipment_models (id),
  board_id uuid references public.boards (id),
  component_id uuid references public.components (id),
  document_type public.document_type not null,
  title text not null,
  language text,
  version_label text,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint,
  checksum text,
  source_label text,
  is_indexed boolean not null default false,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint technical_documents_context_check check (
    manufacturer_id is not null
    or equipment_model_id is not null
    or board_id is not null
    or component_id is not null
  )
);

create table public.symptoms (
  id uuid primary key default gen_random_uuid(),
  equipment_category_id uuid not null references public.equipment_categories (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  symptom_group text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (equipment_category_id, slug)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  test_group text,
  description text,
  default_unit text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  equipment_category_id uuid not null references public.equipment_categories (id),
  manufacturer_id uuid references public.manufacturers (id),
  equipment_model_id uuid references public.equipment_models (id),
  primary_board_id uuid references public.boards (id),
  opened_by_user_id uuid not null references public.users (id),
  assigned_technician_id uuid references public.technician_profiles (id),
  status public.diagnostic_status not null default 'draft',
  priority public.diagnostic_priority not null default 'normal',
  equipment_serial_number text,
  equipment_label text,
  initial_problem_report text not null,
  current_summary text,
  physical_condition_notes text,
  intake_context text,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint diagnostics_initial_problem_report_check check (length(trim(initial_problem_report)) > 0),
  constraint diagnostics_completed_at_check check (
    completed_at is null
    or status in ('resolved', 'unresolved', 'archived')
  )
);

create table public.diagnostic_boards (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  board_id uuid references public.boards (id),
  role_label text not null,
  is_primary boolean not null default false,
  condition_notes text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.ai_responses (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  prompt_context_version text,
  response_role text not null default 'assistant',
  reasoning_summary text,
  recommended_next_step text,
  confidence_score numeric(5, 2),
  raw_response_text text not null,
  structured_response_json jsonb,
  model_name text,
  tokens_input integer,
  tokens_output integer,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.diagnostic_symptoms (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  symptom_id uuid not null references public.symptoms (id),
  severity text,
  is_primary boolean not null default false,
  source_type public.diagnostic_source_type not null default 'technician',
  notes text,
  captured_at timestamptz not null default timezone('utc', now()),
  unique (diagnostic_id, symptom_id, is_primary)
);

create table public.diagnostic_test_runs (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  test_id uuid not null references public.tests (id),
  diagnostic_board_id uuid references public.diagnostic_boards (id),
  board_component_id uuid references public.board_components (id),
  performed_by_user_id uuid not null references public.users (id),
  step_order integer not null check (step_order > 0),
  requested_by_ai_response_id uuid references public.ai_responses (id) on delete set null,
  result_status public.test_result_status not null default 'pending',
  procedure_notes text,
  expected_result text,
  actual_result text,
  conclusion text,
  performed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  diagnostic_test_run_id uuid references public.diagnostic_test_runs (id) on delete set null,
  diagnostic_board_id uuid references public.diagnostic_boards (id),
  board_component_id uuid references public.board_components (id),
  measurement_type public.measurement_type not null,
  point_label text,
  unit text,
  expected_value_text text,
  measured_value_numeric numeric(14, 4),
  measured_value_text text,
  tolerance_text text,
  measurement_context text,
  is_out_of_range boolean not null default false,
  measured_at timestamptz not null default timezone('utc', now()),
  measured_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.hypotheses (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  diagnostic_board_id uuid references public.diagnostic_boards (id),
  board_component_id uuid references public.board_components (id),
  title text not null,
  description text,
  status public.hypothesis_status not null default 'open',
  confidence_score numeric(5, 2),
  evidence_summary text,
  contradictions_summary text,
  created_by_type public.hypothesis_created_by_type not null default 'technician',
  created_by_user_id uuid references public.users (id),
  superseded_by_hypothesis_id uuid references public.hypotheses (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics (id) on delete cascade,
  diagnostic_test_run_id uuid references public.diagnostic_test_runs (id) on delete set null,
  measurement_id uuid references public.measurements (id) on delete set null,
  technical_document_id uuid references public.technical_documents (id) on delete set null,
  attachment_type public.attachment_type not null,
  title text not null,
  description text,
  storage_path text not null,
  mime_type text not null,
  file_size_bytes bigint,
  checksum text,
  captured_at timestamptz,
  uploaded_by_user_id uuid not null references public.users (id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  tag_group text not null,
  color_hint text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (slug, tag_group)
);

create table public.tag_links (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags (id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  created_by_user_id uuid references public.users (id),
  created_at timestamptz not null default timezone('utc', now())
);

create table public.resolved_cases (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null unique references public.diagnostics (id) on delete cascade,
  case_status public.resolved_case_status not null,
  resolution_summary text not null,
  final_failure_mode text,
  repair_outcome text not null,
  time_to_resolution_minutes integer,
  reviewed_by_user_id uuid references public.users (id),
  reviewed_at timestamptz,
  knowledge_promoted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint resolved_cases_review_check check (
    (reviewed_by_user_id is null and reviewed_at is null and knowledge_promoted_at is null)
    or (reviewed_by_user_id is not null and reviewed_at is not null)
  )
);

create table public.confirmed_causes (
  id uuid primary key default gen_random_uuid(),
  resolved_case_id uuid not null references public.resolved_cases (id) on delete cascade,
  diagnostic_board_id uuid references public.diagnostic_boards (id),
  board_component_id uuid references public.board_components (id),
  cause_type public.confirmed_cause_type not null,
  title text not null,
  technical_explanation text not null,
  evidence_summary text,
  confidence_score numeric(5, 2),
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.applied_solutions (
  id uuid primary key default gen_random_uuid(),
  resolved_case_id uuid not null references public.resolved_cases (id) on delete cascade,
  confirmed_cause_id uuid references public.confirmed_causes (id) on delete set null,
  solution_type public.applied_solution_type not null,
  title text not null,
  procedure_description text not null,
  result_notes text,
  was_effective boolean not null default false,
  performed_by_user_id uuid references public.users (id),
  performed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.case_related_documents (
  id uuid primary key default gen_random_uuid(),
  resolved_case_id uuid not null references public.resolved_cases (id) on delete cascade,
  technical_document_id uuid not null references public.technical_documents (id) on delete cascade,
  usage_notes text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (resolved_case_id, technical_document_id)
);

create table public.embedding_sources (
  id uuid primary key default gen_random_uuid(),
  source_type public.embedding_source_type not null,
  source_id uuid not null,
  content_role public.embedding_content_role not null,
  content_text text not null,
  content_hash text not null,
  language text,
  is_active boolean not null default true,
  last_generated_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.embeddings (
  id uuid primary key default gen_random_uuid(),
  embedding_source_id uuid not null references public.embedding_sources (id) on delete cascade,
  model_name text not null,
  vector_dimensions integer not null default 1536,
  vector_value extensions.vector(1536) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  technical_document_id uuid not null references public.technical_documents (id) on delete cascade,
  chunk_order integer not null check (chunk_order > 0),
  page_reference text,
  section_label text,
  chunk_text text not null,
  token_estimate integer,
  created_at timestamptz not null default timezone('utc', now()),
  unique (technical_document_id, chunk_order)
);

create table public.change_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  change_type public.change_type not null,
  field_name text,
  old_value_text text,
  new_value_text text,
  change_reason text,
  changed_by_user_id uuid references public.users (id),
  changed_at timestamptz not null default timezone('utc', now())
);

create table public.entity_reviews (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  review_status public.review_status not null,
  review_notes text,
  reviewed_by_user_id uuid not null references public.users (id),
  reviewed_at timestamptz not null default timezone('utc', now())
);

create index idx_users_auth_user_id on public.users (auth_user_id);
create index idx_equipment_models_manufacturer_id on public.equipment_models (manufacturer_id);
create index idx_equipment_models_category_id on public.equipment_models (equipment_category_id);
create index idx_boards_manufacturer_id on public.boards (manufacturer_id);
create unique index idx_boards_unique_code_revision
on public.boards (board_type_id, board_code, coalesce(board_revision, ''));
create index idx_model_boards_board_id on public.model_boards (board_id);
create index idx_board_components_component_id on public.board_components (component_id);
create index idx_technical_documents_model_id on public.technical_documents (equipment_model_id);
create index idx_technical_documents_board_id on public.technical_documents (board_id);
create index idx_technical_documents_component_id on public.technical_documents (component_id);
create index idx_symptoms_category_id on public.symptoms (equipment_category_id);
create index idx_diagnostics_status on public.diagnostics (status);
create index idx_diagnostics_assigned_technician_id on public.diagnostics (assigned_technician_id);
create index idx_diagnostics_model_id on public.diagnostics (equipment_model_id);
create index idx_diagnostic_boards_diagnostic_id on public.diagnostic_boards (diagnostic_id);
create index idx_diagnostic_symptoms_diagnostic_id on public.diagnostic_symptoms (diagnostic_id);
create index idx_diagnostic_test_runs_diagnostic_id on public.diagnostic_test_runs (diagnostic_id);
create index idx_diagnostic_test_runs_requested_by_ai on public.diagnostic_test_runs (requested_by_ai_response_id);
create index idx_measurements_diagnostic_id on public.measurements (diagnostic_id);
create index idx_hypotheses_diagnostic_id on public.hypotheses (diagnostic_id);
create index idx_ai_responses_diagnostic_id on public.ai_responses (diagnostic_id);
create index idx_attachments_diagnostic_id on public.attachments (diagnostic_id);
create index idx_resolved_cases_case_status on public.resolved_cases (case_status);
create index idx_confirmed_causes_resolved_case_id on public.confirmed_causes (resolved_case_id);
create index idx_applied_solutions_resolved_case_id on public.applied_solutions (resolved_case_id);
create index idx_embedding_sources_lookup on public.embedding_sources (source_type, source_id, content_role);
create index idx_document_chunks_document_id on public.document_chunks (technical_document_id);
create index idx_change_history_entity on public.change_history (entity_type, entity_id);
create index idx_entity_reviews_entity on public.entity_reviews (entity_type, entity_id);

create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_technician_profiles_updated_at
before update on public.technician_profiles
for each row execute function public.set_updated_at();

create trigger set_equipment_categories_updated_at
before update on public.equipment_categories
for each row execute function public.set_updated_at();

create trigger set_manufacturers_updated_at
before update on public.manufacturers
for each row execute function public.set_updated_at();

create trigger set_equipment_models_updated_at
before update on public.equipment_models
for each row execute function public.set_updated_at();

create trigger set_board_types_updated_at
before update on public.board_types
for each row execute function public.set_updated_at();

create trigger set_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger set_model_boards_updated_at
before update on public.model_boards
for each row execute function public.set_updated_at();

create trigger set_components_updated_at
before update on public.components
for each row execute function public.set_updated_at();

create trigger set_board_components_updated_at
before update on public.board_components
for each row execute function public.set_updated_at();

create trigger set_technical_documents_updated_at
before update on public.technical_documents
for each row execute function public.set_updated_at();

create trigger set_symptoms_updated_at
before update on public.symptoms
for each row execute function public.set_updated_at();

create trigger set_tests_updated_at
before update on public.tests
for each row execute function public.set_updated_at();

create trigger set_diagnostics_updated_at
before update on public.diagnostics
for each row execute function public.set_updated_at();

create trigger set_diagnostic_boards_updated_at
before update on public.diagnostic_boards
for each row execute function public.set_updated_at();

create trigger set_measurements_updated_at
before update on public.measurements
for each row execute function public.set_updated_at();

create trigger set_hypotheses_updated_at
before update on public.hypotheses
for each row execute function public.set_updated_at();

create trigger set_attachments_updated_at
before update on public.attachments
for each row execute function public.set_updated_at();

create trigger set_tags_updated_at
before update on public.tags
for each row execute function public.set_updated_at();

create trigger set_resolved_cases_updated_at
before update on public.resolved_cases
for each row execute function public.set_updated_at();

create trigger set_embedding_sources_updated_at
before update on public.embedding_sources
for each row execute function public.set_updated_at();

create trigger on_auth_user_created_or_updated
after insert or update of email, raw_user_meta_data, last_sign_in_at on auth.users
for each row execute function public.handle_auth_user_sync();

revoke all on function public.handle_auth_user_sync() from public;
revoke all on function public.handle_auth_user_sync() from anon;
revoke all on function public.handle_auth_user_sync() from authenticated;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

alter default privileges in schema public
grant select, insert, update, delete on tables to authenticated;

alter default privileges in schema public
grant usage, select on sequences to authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
grant usage, select on sequences to service_role;

alter table public.users enable row level security;
alter table public.technician_profiles enable row level security;
alter table public.equipment_categories enable row level security;
alter table public.manufacturers enable row level security;
alter table public.equipment_models enable row level security;
alter table public.board_types enable row level security;
alter table public.boards enable row level security;
alter table public.model_boards enable row level security;
alter table public.components enable row level security;
alter table public.board_components enable row level security;
alter table public.technical_documents enable row level security;
alter table public.symptoms enable row level security;
alter table public.tests enable row level security;
alter table public.diagnostics enable row level security;
alter table public.diagnostic_boards enable row level security;
alter table public.ai_responses enable row level security;
alter table public.diagnostic_symptoms enable row level security;
alter table public.diagnostic_test_runs enable row level security;
alter table public.measurements enable row level security;
alter table public.hypotheses enable row level security;
alter table public.attachments enable row level security;
alter table public.tags enable row level security;
alter table public.tag_links enable row level security;
alter table public.resolved_cases enable row level security;
alter table public.confirmed_causes enable row level security;
alter table public.applied_solutions enable row level security;
alter table public.case_related_documents enable row level security;
alter table public.embedding_sources enable row level security;
alter table public.embeddings enable row level security;
alter table public.document_chunks enable row level security;
alter table public.change_history enable row level security;
alter table public.entity_reviews enable row level security;

create policy "users_select_authenticated"
on public.users
for select
to authenticated
using (true);

create policy "users_update_self"
on public.users
for update
to authenticated
using (auth_user_id = (select auth.uid()))
with check (auth_user_id = (select auth.uid()));

create policy "technician_profiles_select_authenticated"
on public.technician_profiles
for select
to authenticated
using (true);

create policy "technician_profiles_insert_self"
on public.technician_profiles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
);

create policy "technician_profiles_update_self"
on public.technician_profiles
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
);

do $$
declare
  table_name text;
  shared_tables text[] := array[
    'equipment_categories',
    'manufacturers',
    'equipment_models',
    'board_types',
    'boards',
    'model_boards',
    'components',
    'board_components',
    'technical_documents',
    'symptoms',
    'tests',
    'diagnostics',
    'diagnostic_boards',
    'ai_responses',
    'diagnostic_symptoms',
    'diagnostic_test_runs',
    'measurements',
    'hypotheses',
    'attachments',
    'tags',
    'tag_links',
    'resolved_cases',
    'confirmed_causes',
    'applied_solutions',
    'case_related_documents',
    'embedding_sources',
    'embeddings',
    'document_chunks',
    'change_history',
    'entity_reviews'
  ];
begin
  foreach table_name in array shared_tables
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      table_name || '_select_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (true)',
      table_name || '_insert_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (true) with check (true)',
      table_name || '_update_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (true)',
      table_name || '_delete_authenticated',
      table_name
    );
  end loop;
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'technical-documents',
    'technical-documents',
    false,
    52428800,
    array[
      'application/pdf',
      'application/octet-stream',
      'application/zip',
      'application/x-binary'
    ]
  ),
  (
    'diagnostic-attachments',
    'diagnostic-attachments',
    false,
    52428800,
    array[
      'image/png',
      'image/jpeg',
      'image/webp',
      'video/mp4',
      'application/pdf'
    ]
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "storage_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id in ('technical-documents', 'diagnostic-attachments'));

create policy "storage_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('technical-documents', 'diagnostic-attachments'));

create policy "storage_update_authenticated"
on storage.objects
for update
to authenticated
using (bucket_id in ('technical-documents', 'diagnostic-attachments'))
with check (bucket_id in ('technical-documents', 'diagnostic-attachments'));

create policy "storage_delete_authenticated"
on storage.objects
for delete
to authenticated
using (bucket_id in ('technical-documents', 'diagnostic-attachments'));
