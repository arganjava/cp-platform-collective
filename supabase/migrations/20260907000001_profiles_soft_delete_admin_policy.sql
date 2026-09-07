-- ============================================================================
-- CP Platform — Allow Admins to Soft-Delete and View Archived Profiles
-- ----------------------------------------------------------------------------
-- Why: The policy 'profiles_select_team' had `using (deleted_at is null)`, which
-- prevented PostgREST's RETURNING clause on UPDATE from selecting rows when
-- deleted_at is set to a timestamp. This caused PostgreSQL to reject soft-deletes
-- with error 42501 (new row violates row-level security policy for table "profiles").
--
-- This migration updates the policies so that:
--   1. Admins can select all profiles, including deactivated/soft-deleted rows.
--   2. Admins can update any profile (including setting deleted_at and is_deleted).
--   3. Admins can restore deactivated profiles.
--
-- How to run:
--   1. Supabase Dashboard → SQL Editor → New query → paste → Run.
-- ============================================================================

begin;

-- 1. Helper function to check if the caller is an active workspace admin
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

-- 2. Allow admins to view all profiles (including soft-deleted), while non-admins view active profiles
drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated
  using (
    deleted_at is null or public.is_admin()
  );

-- 3. Allow admins to update and soft-delete/restore any profile
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- 4. Allow admins to hard-delete profiles if ever requested
drop policy if exists "profiles_delete_admin" on public.profiles;
create policy "profiles_delete_admin" on public.profiles
  for delete to authenticated
  using (
    public.is_admin()
  );

commit;
