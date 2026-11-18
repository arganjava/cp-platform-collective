-- ============================================================================
-- CP Platform — Create public.pwds table (Persons with Disabilities Registry)
-- ----------------------------------------------------------------------------
-- Unified schema supporting both:
--   1. CO3 Artists with Disabilities Database CSV:
--      Artist Name, Email, Mobile Telephone, Primary Talent/Art Form,
--      Type of Disability, Standard Rates, Currency,
--      Accessibility Requirements, Previous Collaborations, Portfolio Link
--   2. ELI Grant Artists List CSV:
--      S/N, Name, Disability, Role, Role 2, Age, Gender, Pay Scale
-- ============================================================================

begin;

-- Ensure is_admin() helper exists for RLS policies
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

-- Trigger helper for updated_at
create or replace function public.set_pwds_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Create table public.pwds
create table if not exists public.pwds (
  id                         uuid primary key default gen_random_uuid(),
  serial_no                  integer,
  name                       text not null,
  email                      text,
  mobile_phone               text,
  primary_talent             text,
  secondary_role             text,
  disability_type            text,
  age                        integer check (age is null or (age >= 0 and age <= 150)),
  gender                     text,
  standard_rate              numeric(12, 2) check (standard_rate is null or standard_rate >= 0),
  currency                   text not null default 'SGD',
  accessibility_requirements text,
  previous_collaborations    text,
  portfolio_link             text,
  notes                      text,
  created_at                 timestamptz not null default now(),
  created_by                 uuid references public.profiles (id) on delete set null,
  updated_at                 timestamptz not null default now(),
  updated_by                 uuid references public.profiles (id) on delete set null
);

-- 2. Indexes
create index if not exists idx_pwds_name on public.pwds (name);
create index if not exists idx_pwds_disability_type on public.pwds (disability_type);
create index if not exists idx_pwds_serial_no on public.pwds (serial_no);
create index if not exists idx_pwds_created_at on public.pwds (created_at desc);

-- 3. Trigger to automatically refresh updated_at
drop trigger if exists trg_pwds_updated_at on public.pwds;
create trigger trg_pwds_updated_at
  before update on public.pwds
  for each row
  execute function public.set_pwds_updated_at();

-- 4. Row Level Security on pwds
alter table public.pwds enable row level security;

drop policy if exists "pwds_select_authenticated" on public.pwds;
create policy "pwds_select_authenticated" on public.pwds
  for select to authenticated
  using (true);

drop policy if exists "pwds_insert_admin" on public.pwds;
create policy "pwds_insert_admin" on public.pwds
  for insert to authenticated
  with check (
    public.is_admin()
  );

drop policy if exists "pwds_update_admin" on public.pwds;
create policy "pwds_update_admin" on public.pwds
  for update to authenticated
  using (
    public.is_admin()
  )
  with check (
    public.is_admin()
  );

drop policy if exists "pwds_delete_admin" on public.pwds;
create policy "pwds_delete_admin" on public.pwds
  for delete to authenticated
  using (
    public.is_admin()
  );

-- 5. Seed initial records from provided CO3 & ELI grant CSV files (idempotent)
insert into public.pwds (
  serial_no,
  name,
  email,
  mobile_phone,
  primary_talent,
  secondary_role,
  disability_type,
  age,
  gender,
  standard_rate,
  currency,
  accessibility_requirements,
  previous_collaborations,
  portfolio_link,
  notes
)
select
  v.serial_no,
  v.name,
  v.email,
  v.mobile_phone,
  v.primary_talent,
  v.secondary_role,
  v.disability_type,
  v.age,
  v.gender,
  v.standard_rate,
  v.currency,
  v.accessibility_requirements,
  v.previous_collaborations,
  v.portfolio_link,
  v.notes
from (
  values
    (
      null::integer,
      'Daniel Oon',
      null::text,
      null::text,
      'Guitar player (Female voice)',
      null::text,
      null::text,
      null::integer,
      null::text,
      200.00::numeric(12, 2),
      'SGD',
      null::text,
      null::text,
      null::text,
      'Imported from CO3 Artists with Disabilities Database'
    ),
    (
      null::integer,
      'Yue Ting',
      null::text,
      null::text,
      'Quilling & Paper Jewelry',
      null::text,
      'Autism',
      null::integer,
      null::text,
      null::numeric(12, 2),
      'SGD',
      null::text,
      null::text,
      'https://www.artforgood.sg/featured-artists',
      'Imported from CO3 Artists with Disabilities Database'
    ),
    (
      1,
      'Jackie Chionh',
      null::text,
      null::text,
      'One-Handed Card Illusionist. Performer',
      'DMS',
      'Partial use of body',
      36,
      'm',
      1500.00::numeric(12, 2),
      'SGD',
      null::text,
      null::text,
      null::text,
      'ELI grant list'
    )
) as v (
  serial_no,
  name,
  email,
  mobile_phone,
  primary_talent,
  secondary_role,
  disability_type,
  age,
  gender,
  standard_rate,
  currency,
  accessibility_requirements,
  previous_collaborations,
  portfolio_link,
  notes
)
where not exists (
  select 1 from public.pwds p where lower(trim(p.name)) = lower(trim(v.name))
);

commit;
