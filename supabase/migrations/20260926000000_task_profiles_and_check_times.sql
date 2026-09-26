-- ============================================================================
-- CP Platform — Task Profiles (Multiple Assignees) & Check Times & Calendar
-- ----------------------------------------------------------------------------
-- 1. Adds check_start_time, check_end_time, and google_calendar_id to tasks table.
-- 2. Migrates existing check_date data into check_start_time and check_end_time.
-- 3. Creates table task_profiles mapping task_id and profile_id with RLS & indexes.
-- 4. Migrates existing tasks.assignee_id into task_profiles.
-- ============================================================================

begin;

-- 1. Add new columns to public.tasks
alter table public.tasks add column if not exists check_start_time timestamptz;
alter table public.tasks add column if not exists check_end_time timestamptz;
alter table public.tasks add column if not exists google_calendar_id text;

-- 2. Migrate existing check_date data into check_start_time and check_end_time
update public.tasks
set 
  check_start_time = coalesce(check_start_time, (check_date::text || ' 09:00:00+00')::timestamptz),
  check_end_time = coalesce(check_end_time, (check_date::text || ' 10:00:00+00')::timestamptz)
where check_date is not null and check_start_time is null;

-- 3. Create table public.task_profiles for multiple assignees mapping
create table if not exists public.task_profiles (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.tasks (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint uq_task_profiles_task_profile unique (task_id, profile_id)
);

-- Create indexes for performance
create index if not exists idx_task_profiles_task on public.task_profiles (task_id);
create index if not exists idx_task_profiles_profile on public.task_profiles (profile_id);

-- Enable Row Level Security
alter table public.task_profiles enable row level security;

-- Authenticated users can view task memberships
drop policy if exists "task_profiles_select" on public.task_profiles;
create policy "task_profiles_select" on public.task_profiles
  for select to authenticated using (true);

-- Authenticated users / admins can manage task memberships
drop policy if exists "task_profiles_all" on public.task_profiles;
create policy "task_profiles_all" on public.task_profiles
  for all to authenticated using (true) with check (true);

-- 4. Migrate existing tasks.assignee_id into task_profiles
insert into public.task_profiles (task_id, profile_id)
select distinct t.id, t.assignee_id
from public.tasks t
where t.assignee_id is not null
  and exists (select 1 from public.profiles p where p.id = t.assignee_id)
on conflict (task_id, profile_id) do nothing;

-- Clean up any task_profiles notification trigger/function if previously created
drop trigger if exists tr_task_profile_assignment_notification on public.task_profiles;
drop function if exists public.handle_task_profile_assignment_notification();

commit;
