-- ============================================================================
-- CP Platform — Add clients table and migrate sales.client_name to sales.client_id
-- ----------------------------------------------------------------------------
-- 1. Create table public.clients(id, name, created_at, created_by, updated_at, updated_by)
-- 2. Seed data into public.clients from distinct non-empty public.sales.client_name
-- 3. Alter table public.sales add column client_id foreign key to public.clients(id)
-- 4. Update public.sales setting client_id from matching clients.name = sales.client_name
-- 5. Drop column public.sales.client_name
-- 6. Enable RLS and add policies (admins can manage, team members can view)
-- ============================================================================

begin;

-- Helper function: ensure is_admin() exists for RLS checks
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

-- 1. Create table public.clients
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id) on delete set null
);

-- 2. Seed distinct client names from sales.client_name before modifying sales
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales'
      and column_name = 'client_name'
  ) then
    insert into public.clients (name, created_at, updated_at)
    select distinct trim(client_name), now(), now()
    from public.sales
    where client_name is not null
      and trim(client_name) <> ''
    on conflict (name) do nothing;
  end if;
end $$;

-- 3. Alter table sales add column client_id
alter table public.sales
  add column if not exists client_id uuid references public.clients (id) on delete set null;

-- 4. Update sales with client_id based on sales.client_name = clients.name
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales'
      and column_name = 'client_name'
  ) then
    update public.sales s
    set client_id = c.id
    from public.clients c
    where trim(s.client_name) = c.name
      and s.client_id is null;
  end if;
end $$;

-- 5. Drop column sales.client_name
alter table public.sales
  drop column if exists client_name;

-- 6. Indexes
create index if not exists idx_sales_client_id on public.sales (client_id);
create index if not exists idx_clients_name on public.clients (name);

-- 7. Row Level Security on clients
alter table public.clients enable row level security;

-- Authenticated team members can view clients
drop policy if exists "clients_select_team" on public.clients;
create policy "clients_select_team" on public.clients
  for select to authenticated
  using (true);

-- Only admins can insert clients
drop policy if exists "clients_insert_admin" on public.clients;
create policy "clients_insert_admin" on public.clients
  for insert to authenticated
  with check (
    public.is_admin()
  );

-- Only admins can update clients
drop policy if exists "clients_update_admin" on public.clients;
create policy "clients_update_admin" on public.clients
  for update to authenticated
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

-- Only admins can delete clients
drop policy if exists "clients_delete_admin" on public.clients;
create policy "clients_delete_admin" on public.clients
  for delete to authenticated
  using (
    public.is_admin()
  );

commit;
