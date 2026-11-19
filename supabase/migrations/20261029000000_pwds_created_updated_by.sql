-- ============================================================================
-- CP Platform — Ensure created_by and updated_by audit columns & triggers
-- on public.pwds
-- ----------------------------------------------------------------------------
-- 1. Ensure created_by and updated_by columns exist referencing public.profiles(id)
-- 2. Add indexes on created_by and updated_by
-- 3. Auto-populate created_by and updated_by from the current auth user's profile
--    when inserting or updating rows if not explicitly supplied
-- ============================================================================

begin;

-- 1. Ensure columns exist idempotently
alter table public.pwds
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

-- 2. Add indexes for audit user lookups
create index if not exists idx_pwds_created_by on public.pwds (created_by);
create index if not exists idx_pwds_updated_by on public.pwds (updated_by);

-- 3. Trigger function to maintain created_by, updated_by, and updated_at
create or replace function public.set_pwds_audit_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  -- Look up active profile matching current Supabase Auth user
  if auth.uid() is not null then
    select id
      into v_profile_id
    from public.profiles
    where auth_user_id = auth.uid()
      and deleted_at is null
      and (is_deleted is null or is_deleted = false)
    limit 1;
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by = v_profile_id;
    end if;
    if new.updated_by is null then
      new.updated_by = coalesce(new.created_by, v_profile_id);
    end if;
    new.updated_at = coalesce(new.updated_at, now());
  elsif tg_op = 'UPDATE' then
    new.updated_at = now();
    if new.updated_by is null then
      new.updated_by = coalesce(v_profile_id, old.updated_by);
    end if;
    if new.created_by is null then
      new.created_by = old.created_by;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pwds_audit_fields on public.pwds;
create trigger trg_pwds_audit_fields
  before insert or update on public.pwds
  for each row
  execute function public.set_pwds_audit_fields();

commit;
