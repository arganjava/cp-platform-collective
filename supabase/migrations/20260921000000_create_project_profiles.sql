-- ============================================================================
-- CP Platform — Create project_profiles table for project membership
-- ----------------------------------------------------------------------------
-- Allows assigning multiple members and guests to projects.
-- Member and guest can see projects they are assigned to, but cannot delete them.
-- ============================================================================

begin;

-- 1. Create table public.project_profiles
create table if not exists public.project_profiles (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_project_profiles_project_profile unique (project_id, profile_id)
);

-- 2. Create indexes
create index if not exists idx_project_profiles_project on public.project_profiles (project_id);
create index if not exists idx_project_profiles_profile on public.project_profiles (profile_id);

-- 3. Backfill from existing projects (owner_id and member_ids)
do $$
begin
  -- From owner_id
  insert into public.project_profiles (project_id, profile_id)
  select id as project_id, owner_id as profile_id
  from public.projects
  where owner_id is not null
  on conflict (project_id, profile_id) do nothing;

  -- From member_ids array
  insert into public.project_profiles (project_id, profile_id)
  select p.id as project_id, unnest(p.member_ids) as profile_id
  from public.projects p
  where p.member_ids is not null and array_length(p.member_ids, 1) > 0
  on conflict (project_id, profile_id) do nothing;
end $$;

-- 4. Enable Row Level Security
alter table public.project_profiles enable row level security;

-- Authenticated users can view project memberships
drop policy if exists "project_profiles_select" on public.project_profiles;
create policy "project_profiles_select" on public.project_profiles
  for select to authenticated using (true);

-- Authenticated users / admins can manage project memberships
drop policy if exists "project_profiles_all" on public.project_profiles;
create policy "project_profiles_all" on public.project_profiles
  for all to authenticated using (true) with check (true);

-- Ensure non-admins cannot delete projects in RLS
-- (Projects table delete policy: only admin can delete)
drop policy if exists "projects_delete_admin_only" on public.projects;
create policy "projects_delete_admin_only" on public.projects
  for delete to authenticated
  using (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and role = 'admin'
        and deleted_at is null
        and (is_deleted is null or is_deleted = false)
    )
  );

commit;
