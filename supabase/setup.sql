-- ============================================================================
-- CP Platform — Supabase setup
-- ----------------------------------------------------------------------------
-- Creates the workspace schema (profiles, projects, tasks, sales,
-- notifications), enables row-level security for authenticated team members,
-- creates the public "avatars" storage bucket, links new auth users to team
-- profiles via trigger, and seeds the CP roster / projects / tasks / sales.
--
-- Run this ONCE in the Supabase SQL editor. It is safe to re-run (all
-- statements are idempotent).
-- ============================================================================

begin;

-- ─────────────────────────── Tables ───────────────────────────

create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  name          text not null,
  email         text not null,
  avatar_color  text,
  role          text not null default 'guest',
  avatar_url    text,
  is_deleted    boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- Ensure columns exist if table was already created earlier
alter table public.profiles add column if not exists is_deleted boolean not null default false;
alter table public.profiles add column if not exists deleted_at timestamptz;

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text not null default '',
  status      text not null default 'active',
  color       text,
  owner_id    uuid references public.profiles (id) on delete set null,
  member_ids  uuid[] not null default '{}'::uuid[],
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now()
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  title       text not null,
  description text not null default '',
  status      text not null default 'todo',
  priority    text not null default 'medium',
  assignee_id uuid references public.profiles (id) on delete set null,
  start_date  date,
  due_date    date,
  tags        text[] not null default '{}'::text[],
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.sales (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete cascade,
  amount      numeric(12, 2) not null default 0,
  client_name text not null default '',
  type        text not null default 'commission',
  date        date,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete cascade,
  message    text not null,
  type       text not null default 'update',
  is_read    boolean not null default false,
  related_id uuid,
  created_at timestamptz not null default now()
);

-- ─────────────────────────── Indexes ───────────────────────────

create index if not exists idx_profiles_email        on public.profiles (email);
create index if not exists idx_projects_owner        on public.projects (owner_id);
create index if not exists idx_tasks_project         on public.tasks (project_id);
create index if not exists idx_tasks_assignee        on public.tasks (assignee_id);
create index if not exists idx_sales_project         on public.sales (project_id);
create index if not exists idx_notifications_user    on public.notifications (user_id);

-- ─────────────────────────── Row Level Security ───────────────────────────
--
-- Internal workspace model: every authenticated team member can read and
-- manage projects/tasks/sales. Profiles are shared as the team roster; a
-- member can create/update only their own profile (or claim a seeded roster
-- entry whose email matches theirs).

alter table public.profiles      enable row level security;
alter table public.projects      enable row level security;
alter table public.tasks         enable row level security;
alter table public.sales         enable row level security;
alter table public.notifications enable row level security;

-- Profiles
drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (
    (auth_user_id = auth.uid() or auth_user_id is null)
    and lower(email) like '%@collectivep.com'
  );

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (
    auth_user_id = auth.uid()
    or (auth_user_id is null and email = auth.jwt() ->> 'email')
  )
  with check (
    (auth_user_id = auth.uid()
      or (auth_user_id is null and email = auth.jwt() ->> 'email'))
    and lower(email) like '%@collectivep.com'
  );

-- Projects
drop policy if exists "projects_all" on public.projects;
create policy "projects_all" on public.projects
  for all to authenticated using (true) with check (true);

-- Tasks
drop policy if exists "tasks_all" on public.tasks;
create policy "tasks_all" on public.tasks
  for all to authenticated using (true) with check (true);

-- Sales
drop policy if exists "sales_all" on public.sales;
create policy "sales_all" on public.sales
  for all to authenticated using (true) with check (true);

-- Notifications
drop policy if exists "notifications_all" on public.notifications;
create policy "notifications_all" on public.notifications
  for all to authenticated using (true) with check (true);

-- ─────────────────────────── Storage: avatars ───────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_public_read" on storage.objects;
create policy "avatars_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_insert" on storage.objects;
create policy "avatars_authenticated_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_update" on storage.objects;
create policy "avatars_authenticated_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars')
  with check (bucket_id = 'avatars');

drop policy if exists "avatars_authenticated_delete" on storage.objects;
create policy "avatars_authenticated_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars');

-- ─────────────────────────── Auth user → profile trigger ───────────────────────────
--
-- Automatically creates a team profile when someone signs up, so the app
-- always has a profile row for the signed-in user.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only create profiles for workspace (@collectivep.com) accounts.
  if lower(coalesce(new.email, '')) not like '%@collectivep.com' then
    return new;
  end if;

  insert into public.profiles (auth_user_id, name, email, avatar_color, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, 'user'), '@', 1),
      'Team member'
    ),
    coalesce(new.email, ''),
    'var(--primary)',
    'member'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── Seed data ───────────────────────────
--
-- CP team roster. The app links sign-ins to these profiles by email, so the
-- team shows up in the workspace immediately.

insert into public.profiles (id, name, email, avatar_color, role, created_at) values
  ('10000000-0000-4000-8000-000000000001', 'Vincent Lim',      'vincent@collectivep.com',   'var(--primary)',       'admin',   '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000002', 'Michael Chua',     'michael@collectivep.com',   'var(--brand)',         'admin',   '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000003', 'Lim Lee Lee',      'leelee@collectivep.com',    'var(--muted-foreground)', 'manager', '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000004', 'Douglas Danapal',  'douglas@collectivep.com',   'var(--destructive)',   'manager', '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000005', 'Abu Sahl (Iqbal)', 'iqbal@collectivep.com',     'var(--primary)',       'member',  '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000006', 'Ryan Putra',       'ryan@collectivep.com',      'var(--brand)',         'member',  '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000007', 'Stephanie Fam',    'stephanie@collectivep.com', 'var(--muted-foreground)', 'member', '2026-01-05T09:00:00Z'),
  ('10000000-0000-4000-8000-000000000008', 'Jeffrey Lim',      'jeffrey@collectivep.com',   'var(--destructive)',   'member',  '2026-01-05T09:00:00Z')
on conflict (id) do nothing;

insert into public.projects (id, title, description, status, color, owner_id, member_ids, start_date, end_date, created_at) values
  (
    '20000000-0000-4000-8000-000000000001',
    'DARE Festival 2026',
    'Annual flagship arts festival celebrating PwD creatives — performances, exhibitions, and digital content.',
    'active', 'var(--primary)',
    '10000000-0000-4000-8000-000000000001',
    array['10000000-0000-4000-8000-000000000001'::uuid, '10000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000005'::uuid],
    '2026-06-01', '2026-11-15', '2026-03-10T09:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'Ville of Joy — Fragrance Launch',
    'Co-created fragrance line with Lim Lee Lee. Packaging, branding, and e-commerce rollout.',
    'active', 'var(--brand)',
    '10000000-0000-4000-8000-000000000003',
    array['10000000-0000-4000-8000-000000000003'::uuid, '10000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000008'::uuid],
    '2026-04-15', '2026-09-30', '2026-04-01T10:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000003',
    'Shades — Poetry Book',
    'Stephanie Esther Fam''s poetry collection. Editing, design, printing, and distribution.',
    'active', 'var(--muted-foreground)',
    '10000000-0000-4000-8000-000000000007',
    array['10000000-0000-4000-8000-000000000007'::uuid, '10000000-0000-4000-8000-000000000008'::uuid, '10000000-0000-4000-8000-000000000002'::uuid],
    '2026-05-01', '2026-08-31', '2026-04-20T11:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    'Corporate Training Programme',
    'Disability awareness & inclusion workshops for corporate partners (TBWA, Far East Org).',
    'active', 'var(--destructive)',
    '10000000-0000-4000-8000-000000000004',
    array['10000000-0000-4000-8000-000000000004'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000006'::uuid],
    '2026-07-01', '2026-12-31', '2026-06-15T08:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000005',
    'Digital Content Hub',
    'Online platform for streaming PwD artist performances, behind-the-scenes, and educational content.',
    'draft', 'var(--primary)',
    '10000000-0000-4000-8000-000000000002',
    array['10000000-0000-4000-8000-000000000002'::uuid, '10000000-0000-4000-8000-000000000005'::uuid, '10000000-0000-4000-8000-000000000006'::uuid],
    '2026-09-01', '2027-03-31', '2026-07-01T09:00:00Z'
  )
on conflict (id) do nothing;

insert into public.tasks (id, project_id, title, description, status, priority, assignee_id, start_date, due_date, tags, sort_order, created_at) values
  -- DARE Festival
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Secure venue booking for DARE Festival', 'Negotiate with National Gallery / Drama Centre for Nov dates', 'done', 'high', '10000000-0000-4000-8000-000000000001', '2026-06-01', '2026-06-30', array['logistics', 'venue'], 0, '2026-06-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Finalise artist lineup and schedule', 'Confirm performers, workshop leaders, exhibition artists', 'done', 'high', '10000000-0000-4000-8000-000000000003', '2026-06-15', '2026-07-31', array['artists', 'programming'], 1, '2026-06-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'Design festival marketing materials', 'Poster, social media assets, programme booklet', 'in_progress', 'high', '10000000-0000-4000-8000-000000000008', '2026-07-01', '2026-08-15', array['design', 'marketing'], 0, '2026-07-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'Apply for NAC grant funding', 'National Arts Council project grant application', 'review', 'urgent', '10000000-0000-4000-8000-000000000002', '2026-07-10', '2026-07-31', array['funding', 'admin'], 0, '2026-07-10T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'Set up accessibility arrangements', 'Wheelchair access, sign language interpreters, audio descriptions', 'in_progress', 'high', '10000000-0000-4000-8000-000000000004', '2026-07-15', '2026-09-30', array['accessibility'], 1, '2026-07-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000001', 'Launch ticket sales', 'Set up Eventbrite / Peatix and begin early bird sales', 'todo', 'medium', '10000000-0000-4000-8000-000000000005', '2026-08-01', '2026-08-31', array['ticketing', 'sales'], 0, '2026-07-20T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000001', 'Coordinate volunteer team', 'Recruit and brief 50+ volunteers for festival days', 'todo', 'medium', '10000000-0000-4000-8000-000000000006', '2026-09-01', '2026-10-31', array['volunteers'], 1, '2026-07-22T09:00:00Z'),
  -- Ville of Joy
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000002', 'Finalise fragrance formulations', 'Work with Lynk Artisan on scent profiles', 'done', 'high', '10000000-0000-4000-8000-000000000003', '2026-04-15', '2026-05-31', array['product'], 0, '2026-04-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000002', 'Design packaging and labels', 'Bottle design, box design, label copy', 'in_progress', 'high', '10000000-0000-4000-8000-000000000008', '2026-06-01', '2026-07-31', array['design', 'packaging'], 0, '2026-06-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 'Set up e-commerce store page', 'Product listing, photos, descriptions on Shopify', 'todo', 'medium', '10000000-0000-4000-8000-000000000007', '2026-07-15', '2026-08-31', array['e-commerce'], 0, '2026-07-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000002', 'Plan launch event', 'Intimate launch with media, influencers, and partners', 'todo', 'medium', '10000000-0000-4000-8000-000000000003', '2026-08-01', '2026-09-15', array['event', 'PR'], 1, '2026-07-20T09:00:00Z'),
  -- Shades
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000003', 'Complete manuscript editing', 'Final proofreading and copy editing', 'review', 'high', '10000000-0000-4000-8000-000000000007', '2026-05-01', '2026-06-30', array['editing'], 0, '2026-05-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000003', 'Book cover design', 'Collaborate with artist for cover illustration', 'in_progress', 'medium', '10000000-0000-4000-8000-000000000008', '2026-06-15', '2026-07-31', array['design'], 0, '2026-06-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000003', 'Arrange printing', 'Get quotes from local printers, select paper stock', 'todo', 'medium', '10000000-0000-4000-8000-000000000002', '2026-07-15', '2026-08-15', array['printing'], 0, '2026-07-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000003', 'Plan book launch', 'Venue, readings, media invite', 'todo', 'low', '10000000-0000-4000-8000-000000000007', '2026-08-01', '2026-08-31', array['event'], 1, '2026-07-20T09:00:00Z'),
  -- Corporate Training
  ('30000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000004', 'Develop workshop curriculum', '4-module programme on disability inclusion', 'in_progress', 'high', '10000000-0000-4000-8000-000000000004', '2026-07-01', '2026-08-15', array['curriculum'], 0, '2026-07-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000017', '20000000-0000-4000-8000-000000000004', 'Create training materials', 'Slide decks, handouts, video content', 'todo', 'medium', '10000000-0000-4000-8000-000000000005', '2026-08-01', '2026-09-30', array['materials'], 0, '2026-07-15T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000018', '20000000-0000-4000-8000-000000000004', 'Pilot workshop with TBWA', 'Run first session, collect feedback', 'todo', 'high', '10000000-0000-4000-8000-000000000004', '2026-10-01', '2026-10-31', array['pilot', 'delivery'], 1, '2026-07-20T09:00:00Z'),
  -- Digital Content Hub
  ('30000000-0000-4000-8000-000000000019', '20000000-0000-4000-8000-000000000005', 'Research platform options', 'Compare Vimeo OTT, custom build, YouTube', 'in_progress', 'medium', '10000000-0000-4000-8000-000000000006', '2026-07-01', '2026-08-15', array['research', 'tech'], 0, '2026-07-01T09:00:00Z'),
  ('30000000-0000-4000-8000-000000000020', '20000000-0000-4000-8000-000000000005', 'Content strategy document', 'Define content pillars, upload schedule, monetisation', 'todo', 'low', '10000000-0000-4000-8000-000000000002', '2026-08-01', '2026-09-30', array['strategy'], 0, '2026-07-15T09:00:00Z')
on conflict (id) do nothing;

insert into public.sales (id, project_id, amount, client_name, type, date, notes, created_at) values
  ('40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 15000, 'National Arts Council', 'grant',       '2026-04-15', 'DARE Festival project grant — approved', '2026-04-15T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 8500,  'Far East Organization', 'sponsorship', '2026-05-20', 'Title sponsor for DARE Festival 2026',   '2026-05-20T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 5000,  'TBWA Singapore',       'sponsorship', '2026-06-10', 'Supporting sponsor',                     '2026-06-10T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000002', 3200,  'Lynk Artisan',          'commission',  '2026-05-01', 'Co-creation partnership revenue share',  '2026-05-01T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 1800,  'Online Store',          'artwork',     '2026-07-15', 'Pre-order fragrance sales (20 units)',   '2026-07-15T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', 2000,  'National Library Board','commission',  '2026-06-20', 'Library bulk purchase of Shades',        '2026-06-20T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000004', 12000, 'TBWA Singapore',        'workshop',    '2026-07-01', '4-session corporate training contract',  '2026-07-01T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000004', 6500,  'CPAS',                  'workshop',    '2026-07-10', '2-session disability awareness programme', '2026-07-10T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000001', 4200,  'Ticket Sales',          'artwork',     '2026-07-20', 'Early bird ticket revenue (84 tickets)', '2026-07-20T10:00:00Z'),
  ('40000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000002', 950,   'Online Store',          'artwork',     '2026-07-25', 'Additional fragrance orders',            '2026-07-25T10:00:00Z')
on conflict (id) do nothing;

insert into public.notifications (id, user_id, message, type, is_read, related_id, created_at) values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Michael submitted the NAC grant application for review', 'update',    false, '30000000-0000-4000-8000-000000000004', '2026-07-28T08:30:00Z'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'You were assigned to launch ticket sales for DARE Festival', 'assignment', false, '30000000-0000-4000-8000-000000000006', '2026-07-27T14:00:00Z'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'Deadline approaching: Festival marketing materials due in 18 days', 'deadline', false, '30000000-0000-4000-8000-000000000003', '2026-07-27T09:00:00Z'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', 'Stephanie completed manuscript editing — moved to review', 'update',    true,  '30000000-0000-4000-8000-000000000012', '2026-07-26T16:00:00Z'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'New sale logged: $4,200 from ticket sales', 'update', true, '40000000-0000-4000-8000-000000000009', '2026-07-20T10:30:00Z'),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', 'Douglas added a comment on accessibility arrangements', 'comment', true, '30000000-0000-4000-8000-000000000005', '2026-07-19T11:00:00Z'),
  ('50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000001', 'Ryan started research on Digital Content Hub platform', 'update', true, '30000000-0000-4000-8000-000000000019', '2026-07-18T09:00:00Z'),
  ('50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000001', 'TBWA workshop contract confirmed — $12,000', 'update', true, '40000000-0000-4000-8000-000000000007', '2026-07-01T14:00:00Z')
on conflict (id) do nothing;

commit;
