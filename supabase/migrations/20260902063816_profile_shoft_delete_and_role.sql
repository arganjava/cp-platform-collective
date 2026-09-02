-- Add soft delete support and update role defaults
-- This migration adds deleted_at column to profiles for soft deletes
-- and updates role from 'member' to 'guest' as default

begin;

-- Add deleted_at column to profiles table
alter table public.profiles 
add column if not exists deleted_at timestamptz;


-- Update default role from 'member' to 'guest'
alter table public.profiles 
alter column role set default 'guest';

-- Drop and recreate indexes to filter out soft-deleted users
drop index if exists idx_profiles_email;
create index idx_profiles_email on public.profiles (email) where deleted_at is null;

-- Add index for active profiles
create index if not exists idx_profiles_active on public.profiles (id) where deleted_at is null;

-- Update RLS policies to respect soft deletes
drop policy if exists "profiles_select_team" on public.profiles;
create policy "profiles_select_team" on public.profiles
  for select to authenticated using (deleted_at is null);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (
    (auth_user_id = auth.uid()
      or (auth_user_id is null and email = auth.jwt() ->> 'email'))
    and deleted_at is null
  )
  with check (
    (auth_user_id = auth.uid()
      or (auth_user_id is null and email = auth.jwt() ->> 'email'))
    and lower(email) like '%@collectivep.com'
  );

-- Update trigger to use 'guest' as default role
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
    'guest'
  )
  on conflict (auth_user_id) do nothing;
  return new;
end;
$$;

commit;