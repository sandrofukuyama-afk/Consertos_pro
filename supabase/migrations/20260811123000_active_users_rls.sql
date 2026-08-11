create or replace function public.current_active_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.status = 'active'
  limit 1;
$$;

create or replace function public.is_active_authenticated_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_active_user_id() is not null;
$$;

revoke all on function public.current_active_user_id() from public;
revoke all on function public.is_active_authenticated_user() from public;

grant execute on function public.current_active_user_id() to authenticated, service_role;
grant execute on function public.is_active_authenticated_user() to authenticated, service_role;

drop policy if exists "users_select_authenticated" on public.users;
create policy "users_select_authenticated"
on public.users
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self"
on public.users
for update
to authenticated
using (
  public.is_active_authenticated_user()
  and auth_user_id = (select auth.uid())
)
with check (
  public.is_active_authenticated_user()
  and auth_user_id = (select auth.uid())
);

drop policy if exists "technician_profiles_select_authenticated" on public.technician_profiles;
create policy "technician_profiles_select_authenticated"
on public.technician_profiles
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists "technician_profiles_insert_self" on public.technician_profiles;
create policy "technician_profiles_insert_self"
on public.technician_profiles
for insert
to authenticated
with check (
  public.is_active_authenticated_user()
  and exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "technician_profiles_update_self" on public.technician_profiles;
create policy "technician_profiles_update_self"
on public.technician_profiles
for update
to authenticated
using (
  public.is_active_authenticated_user()
  and exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
)
with check (
  public.is_active_authenticated_user()
  and exists (
    select 1
    from public.users u
    where u.id = user_id
      and u.auth_user_id = (select auth.uid())
  )
);

drop policy if exists "technician_profiles_update_authenticated" on public.technician_profiles;
create policy "technician_profiles_update_authenticated"
on public.technician_profiles
for update
to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

drop policy if exists "technician_profiles_delete_authenticated" on public.technician_profiles;
create policy "technician_profiles_delete_authenticated"
on public.technician_profiles
for delete
to authenticated
using (public.is_active_authenticated_user());

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
      'drop policy if exists %I on public.%I',
      table_name || '_select_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_active_authenticated_user())',
      table_name || '_select_authenticated',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_insert_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_active_authenticated_user())',
      table_name || '_insert_authenticated',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_update_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_active_authenticated_user()) with check (public.is_active_authenticated_user())',
      table_name || '_update_authenticated',
      table_name
    );

    execute format(
      'drop policy if exists %I on public.%I',
      table_name || '_delete_authenticated',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_active_authenticated_user())',
      table_name || '_delete_authenticated',
      table_name
    );
  end loop;
end
$$;

drop policy if exists "ai_response_feedback_select_authenticated" on public.ai_response_feedback;
create policy "ai_response_feedback_select_authenticated"
on public.ai_response_feedback
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists "ai_response_feedback_insert_authenticated" on public.ai_response_feedback;
create policy "ai_response_feedback_insert_authenticated"
on public.ai_response_feedback
for insert
to authenticated
with check (public.is_active_authenticated_user());

drop policy if exists "ai_response_feedback_update_authenticated" on public.ai_response_feedback;
create policy "ai_response_feedback_update_authenticated"
on public.ai_response_feedback
for update
to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

drop policy if exists "ai_response_feedback_delete_authenticated" on public.ai_response_feedback;
create policy "ai_response_feedback_delete_authenticated"
on public.ai_response_feedback
for delete
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists "Allow all operations for authenticated users on board_measurements" on public.board_measurements;
create policy "Allow all operations for authenticated users on board_measurements"
on public.board_measurements
for all
to authenticated
using (public.is_active_authenticated_user())
with check (public.is_active_authenticated_user());

drop policy if exists "Allow all authenticated users to read token logs" on public.ai_token_logs;
create policy "Allow all authenticated users to read token logs"
on public.ai_token_logs
for select
to authenticated
using (public.is_active_authenticated_user());

drop policy if exists "Allow insertion of token logs by authenticated users" on public.ai_token_logs;
create policy "Allow insertion of token logs by authenticated users"
on public.ai_token_logs
for insert
to authenticated
with check (public.is_active_authenticated_user());

drop policy if exists "storage_select_authenticated" on storage.objects;
create policy "storage_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('technical-documents', 'diagnostic-attachments')
  and public.is_active_authenticated_user()
);

drop policy if exists "storage_insert_authenticated" on storage.objects;
create policy "storage_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('technical-documents', 'diagnostic-attachments')
  and public.is_active_authenticated_user()
);

drop policy if exists "storage_update_authenticated" on storage.objects;
create policy "storage_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('technical-documents', 'diagnostic-attachments')
  and public.is_active_authenticated_user()
)
with check (
  bucket_id in ('technical-documents', 'diagnostic-attachments')
  and public.is_active_authenticated_user()
);

drop policy if exists "storage_delete_authenticated" on storage.objects;
create policy "storage_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('technical-documents', 'diagnostic-attachments')
  and public.is_active_authenticated_user()
);
