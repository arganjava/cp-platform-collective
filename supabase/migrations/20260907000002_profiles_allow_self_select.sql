-- Allow authenticated users to view their own profile row (regardless of deleted_at)
-- so the client and login flow can reliably check profiles.is_deleted upon sign-in.
begin;

drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated
  using (
    deleted_at is null
    or public.is_admin()
    or auth.uid() = auth_user_id
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

commit;
