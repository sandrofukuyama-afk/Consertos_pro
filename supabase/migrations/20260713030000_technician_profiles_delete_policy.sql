do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'technician_profiles'
      and policyname = 'technician_profiles_delete_authenticated'
  ) then
    create policy "technician_profiles_delete_authenticated"
    on public.technician_profiles
    for delete
    to authenticated
    using (true);
  end if;
end
$$;
