-- ============================================================================
-- CP Platform — Add sale_stages table for sales pipeline tracking
-- ----------------------------------------------------------------------------
-- Creates table public.sale_stages with:
--   - id: uuid primary key
--   - sale_id: uuid not null references public.sales(id) on delete cascade
--   - status: Opportunity, Discussion, Closed, Lost
--   - date: timestamptz not null default now()
--   - pic_profile_id: uuid references public.profiles(id) on delete set null (nullable)
--   - value: numeric(12, 2) not null default 0
--   - created_at: timestamptz not null default now()
--   - updated_at: timestamptz not null default now()
--   - created_by: uuid references public.profiles(id) on delete set null
--   - updated_by: uuid references public.profiles(id) on delete set null
-- ============================================================================

begin;

-- 1. Create table public.sale_stages
create table if not exists public.sale_stages (
  id              uuid primary key default gen_random_uuid(),
  sale_id         uuid not null references public.sales (id) on delete cascade,
  status          text not null check (status in ('Opportunity', 'Discussion', 'Closed', 'Lost')),
  date            timestamptz not null default now(),
  pic_profile_id  uuid references public.profiles (id) on delete set null,
  value           numeric(12, 2) not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null
);

-- 2. Indexes for efficient lookup
create index if not exists idx_sale_stages_sale_id on public.sale_stages (sale_id);
create index if not exists idx_sale_stages_status on public.sale_stages (status);
create index if not exists idx_sale_stages_pic_profile_id on public.sale_stages (pic_profile_id);
create index if not exists idx_sale_stages_date on public.sale_stages (date);

-- 3. Row Level Security on sale_stages
alter table public.sale_stages enable row level security;

-- Authenticated team members can view sale stages
drop policy if exists "sale_stages_select_team" on public.sale_stages;
create policy "sale_stages_select_team" on public.sale_stages
  for select to authenticated, anon
  using (true);

-- Admins can insert sale stages
drop policy if exists "sale_stages_insert_admin" on public.sale_stages;
create policy "sale_stages_insert_admin" on public.sale_stages
  for insert to authenticated
  with check (
    public.is_admin()
  );

-- Admins can update sale stages
drop policy if exists "sale_stages_update_admin" on public.sale_stages;
create policy "sale_stages_update_admin" on public.sale_stages
  for update to authenticated
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Admins can delete sale stages
drop policy if exists "sale_stages_delete_admin" on public.sale_stages;
create policy "sale_stages_delete_admin" on public.sale_stages
  for delete to authenticated
  using (
    public.is_admin()
  );

commit;
