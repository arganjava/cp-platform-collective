-- ============================================================================
-- CP Platform — Simplified App Config & Notification Webhook Listener
-- ----------------------------------------------------------------------------
-- Creates `public.app_config` table for storing:
--   1. 'BASE_URL'         (e.g. 'https://<project-ref>.supabase.co')
--   2. 'SERVICE_ROLE_KEY' (e.g. 'eyJhbGciOi...')
--
-- The trigger function `handle_notification_webhook` fetches `BASE_URL` and
-- `SERVICE_ROLE_KEY` directly from `public.app_config`, inserts a log into
-- `public.notification_webhook_logs`, and calls the edge function via pg_net.
-- ============================================================================

begin;

-- Drop previous helper functions if present
drop function if exists public.get_supabase_functions_base_url();
drop function if exists public.get_supabase_service_role_key();

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Application Configuration Table
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_config (
  key         text primary key,
  value       text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop policy if exists "app_config_read_authenticated" on public.app_config;
create policy "app_config_read_authenticated" on public.app_config
  for select to authenticated using (true);

drop policy if exists "app_config_admin_manage" on public.app_config;
create policy "app_config_admin_manage" on public.app_config
  for all to authenticated
  using (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and role = 'admin'
        and deleted_at is null
        and (is_deleted is null or is_deleted = false)
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where auth_user_id = auth.uid()
        and role = 'admin'
        and deleted_at is null
        and (is_deleted is null or is_deleted = false)
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Trigger Function: handle_notification_webhook
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_email        text;
  v_user_name         text;
  v_base_url          text;
  v_service_key       text;
  v_edge_function_url text;
  v_payload           jsonb;
  v_headers           jsonb;
begin
  -- 1. Look up recipient profile email and name from public.profiles
  select email, name into v_user_email, v_user_name
  from public.profiles
  where id = NEW.user_id
    and deleted_at is null 
    and (is_deleted is null or is_deleted = false);

  -- Only proceed if recipient has a valid email
  if v_user_email is not null and v_user_email <> '' then
    -- 2. Fetch BASE_URL and SERVICE_ROLE_KEY directly from public.app_config
    select value into v_base_url
    from public.app_config
    where key in ('BASE_URL', 'base_url')
    limit 1;

    select value into v_service_key
    from public.app_config
    where key in ('SERVICE_ROLE_KEY', 'service_role_key')
    limit 1;

    -- 3. Construct the complete Edge Function URL
    -- Fallback to local default if BASE_URL has not been inserted yet
    if v_base_url is null or v_base_url = '' then
      v_base_url := 'http://127.0.0.1:54321';
    end if;

    if v_base_url like '%/functions/v1%' then
      v_edge_function_url := rtrim(v_base_url, '/') || '/send-notification-email';
    else
      v_edge_function_url := rtrim(v_base_url, '/') || '/functions/v1/send-notification-email';
    end if;

    -- 4. Build notification payload
    v_payload := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'message', NEW.message,
        'type', NEW.type,
        'is_read', NEW.is_read,
        'related_id', NEW.related_id,
        'created_at', NEW.created_at
      ),
      'recipient', jsonb_build_object(
        'name', coalesce(v_user_name, 'Team Member'),
        'email', v_user_email
      )
    );

    -- 5. Insert audit log into public.notification_webhook_logs
    insert into public.notification_webhook_logs (
      notification_id,
      user_id,
      recipient_email,
      status,
      payload,
      created_at,
      updated_at
    ) values (
      NEW.id,
      NEW.user_id,
      v_user_email,
      'pending',
      v_payload,
      now(),
      now()
    );

    -- 6. Prepare request headers with Authorization Bearer
    if v_service_key is not null and v_service_key <> '' then
      v_headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_key
      );
    else
      v_headers := jsonb_build_object(
        'Content-Type', 'application/json'
      );
    end if;

    -- 7. Call the Edge Function via pg_net (extensions.http_post)
    begin
      perform net.http_post(
          url := v_edge_function_url,
          headers := v_headers,
          body := v_payload,
          timeout_milliseconds := 5000
        );
    exception when others then
      -- Record failure in log without rolling back the notification creation
      update public.notification_webhook_logs
      set status = 'failed',
          error_message = SQLERRM,
          updated_at = now()
      where notification_id = NEW.id and status = 'pending';
    end;
  end if;

  return NEW;
end;
$$;

commit;
