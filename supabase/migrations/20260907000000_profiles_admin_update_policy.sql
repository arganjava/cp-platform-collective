-- ============================================================================
-- CP Platform — Allow Admins to Update and Archive Other User Profiles
-- ----------------------------------------------------------------------------
-- Why: The default RLS policy 'profiles_update_self' only permits users to update
-- their own row (auth_user_id = auth.uid()). This policy grants users who have the
-- 'admin' role in public.profiles permission to update and soft-delete/archive
-- any active profile row directly from their authenticated session.
--
-- How to run:
--   1. Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

begin;

-- Helper function to check if the caller is an active workspace admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where auth_user_id = auth.uid()
      and role = 'admin'
      and deleted_at is null
      and (is_deleted is null or is_deleted = false)
  );
$$;

-- Allow admins to update any profile row
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

commit;
