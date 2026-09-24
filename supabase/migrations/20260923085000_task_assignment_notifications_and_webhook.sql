-- ============================================================================
-- CP Platform — Task Assignment Notifications & Edge Function Webhook Listener
-- ----------------------------------------------------------------------------
-- 1. Automatically inserts a notification into public.notifications when a task
--    is assigned to an assignee_id on create (INSERT) or update (UPDATE).
-- 2. Listens for new rows inserted into public.notifications and triggers an
--    asynchronous webhook to the Supabase Edge Function (send-notification-email)
--    which sends an email alert to the user's profiles.email.
-- 3. Provides an audit log table (public.notification_webhook_logs) to record
--    dispatches and email delivery states.
-- ============================================================================

begin;

-- Enable pg_net extension if available for asynchronous database webhooks
create extension if not exists pg_net with schema extensions;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Webhook Logs Table for Notification Deliveries
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_webhook_logs (
  id               uuid primary key default gen_random_uuid(),
  notification_id  uuid references public.notifications (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete set null,
  recipient_email  text,
  status           text not null default 'pending', -- 'pending' | 'sent' | 'failed' | 'simulated'
  payload          jsonb,
  response_code    integer,
  response_body    text,
  error_message    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_notification_webhook_logs_notif on public.notification_webhook_logs (notification_id);
create index if not exists idx_notification_webhook_logs_user  on public.notification_webhook_logs (user_id);
create index if not exists idx_notification_webhook_logs_status on public.notification_webhook_logs (status);

alter table public.notification_webhook_logs enable row level security;

drop policy if exists "notification_webhook_logs_all" on public.notification_webhook_logs;
create policy "notification_webhook_logs_all" on public.notification_webhook_logs
  for all to authenticated using (true) with check (true);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Trigger Function: Task Assignment -> Notifications Table
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_task_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_title text;
  v_message text;
begin
  -- Trigger when assignee_id is provided on INSERT,
  -- or when assignee_id changes to a non-null value on UPDATE.
  if NEW.assignee_id is not null and (
    TG_OP = 'INSERT' or 
    (TG_OP = 'UPDATE' and (OLD.assignee_id is distinct from NEW.assignee_id))
  ) then
    -- Query project title for context if project_id exists
    select title into v_project_title 
    from public.projects 
    where id = NEW.project_id;

    if v_project_title is not null and v_project_title <> '' then
      v_message := 'You have been assigned to task: "' || NEW.title || '" in project "' || v_project_title || '"';
    else
      v_message := 'You have been assigned to task: "' || NEW.title || '"';
    end if;

    insert into public.notifications (
      id,
      user_id,
      message,
      type,
      is_read,
      related_id,
      created_at
    ) values (
      gen_random_uuid(),
      NEW.assignee_id,
      v_message,
      'assignment',
      false,
      NEW.id,
      now()
    );
  end if;

  return NEW;
end;
$$;

drop trigger if exists tr_task_assignment_notification on public.tasks;
create trigger tr_task_assignment_notification
  after insert or update of assignee_id, title, project_id
  on public.tasks
  for each row
  execute function public.handle_task_assignment_notification();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Trigger Function: Notifications Table -> Webhook Listener & Email Dispatch
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_notification_webhook()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_email text;
  v_user_name text;
  v_edge_function_url text;
  v_service_key text;
  v_payload jsonb;
begin
  -- Look up recipient profile email and name (must be active profile)
  select email, name into v_user_email, v_user_name
  from public.profiles
  where id = NEW.user_id
    and deleted_at is null 
    and (is_deleted is null or is_deleted = false);

  -- Only proceed if recipient has a valid email address
  if v_user_email is not null and v_user_email <> '' then
    -- Construct structured webhook payload matching Supabase Edge Function standards
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

    -- Record pending log entry
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

    -- Determine Edge Function target URL (configurable via settings)
    v_edge_function_url := coalesce(
      nullif(current_setting('app.settings.edge_function_base_url', true), ''),
      nullif(current_setting('app.settings.supabase_functions_url', true), ''),
      'http://127.0.0.1:54321/functions/v1'
    ) || '/send-notification-email';

    v_service_key := coalesce(
      nullif(current_setting('app.settings.service_role_key', true), ''),
      ''
    );

    -- Safely attempt async HTTP POST via pg_net
    begin
      if exists (
        select 1 from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname in ('net', 'extensions') and p.proname = 'http_post'
      ) then
        perform extensions.http_post(
          url := v_edge_function_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := v_payload,
          timeout_milliseconds := 5000
        );
      end if;
    exception when others then
      -- Do not fail the notification insert if the network or webhook endpoint is unavailable
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

drop trigger if exists tr_notifications_webhook_listener on public.notifications;
create trigger tr_notifications_webhook_listener
  after insert on public.notifications
  for each row
  execute function public.handle_notification_webhook();

commit;
