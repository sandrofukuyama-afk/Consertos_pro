do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'technician_profiles'
      and policyname = 'technician_profiles_update_authenticated'
  ) then
    create policy "technician_profiles_update_authenticated"
    on public.technician_profiles
    for update
    to authenticated
    using (true)
    with check (true);
  end if;
end
$$;
