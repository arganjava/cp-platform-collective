-- ============================================================================
-- CP Platform — Multi-User Task Assignment Notifications & Webhook Listener
-- ----------------------------------------------------------------------------
-- 1. Updates `handle_task_assignment_notification` to notify MULTIPLE assignees
--    when a task is created or updated, or when users are added to `task_profiles`.
--    Gathers all assignees (tasks.assignee_id and task_profiles.profile_id),
--    deduplicates, and inserts notification records for every assigned user.
-- 2. Attaches triggers on both `public.tasks` and `public.task_profiles`.
-- 3. Updates `handle_notification_webhook` to robustly dispatch webhooks to the
--    `send-notification-email` edge function for each recipient using pg_net
--    and dynamic credentials from `public.app_config`.
-- 4. Provides `public.notify_task_assignees` helper function for manual or
--    programmatic multi-user task notifications.
-- ============================================================================

begin;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Trigger Function: handle_task_assignment_notification (Multi-User)
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_task_assignment_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_id        uuid;
  v_task_title     text;
  v_project_id     uuid;
  v_project_title  text;
  v_message        text;
  v_recipient_id   uuid;
begin
  -- Determine context based on the table triggering the function
  if TG_TABLE_NAME = 'tasks' then
    v_task_id    := NEW.id;
    v_task_title := NEW.title;
    v_project_id := NEW.project_id;
  elsif TG_TABLE_NAME = 'task_profiles' then
    v_task_id := NEW.task_id;
    select title, project_id into v_task_title, v_project_id
    from public.tasks
    where id = v_task_id;
  end if;

  if v_task_id is null then
    return coalesce(NEW, OLD);
  end if;

  -- Look up project title if project_id is present
  if v_project_id is not null then
    select title into v_project_title
    from public.projects
    where id = v_project_id;
  end if;

  -- Build assignment notification message
  if v_project_title is not null and v_project_title <> '' then
    v_message := 'You have been assigned to task: "' || coalesce(v_task_title, 'Untitled') || '" in project "' || v_project_title || '"';
  else
    v_message := 'You have been assigned to task: "' || coalesce(v_task_title, 'Untitled') || '"';
  end if;

  -- Case A: Triggered from `task_profiles` (a single member added to multiple assignees)
  if TG_TABLE_NAME = 'task_profiles' then
    if NEW.profile_id is not null then
      -- Deduplicate: only insert if no notification was sent to this user for this task within 1 minute
      if not exists (
        select 1 from public.notifications
        where user_id = NEW.profile_id
          and related_id = v_task_id
          and created_at > now() - interval '1 minute'
      ) then
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
          NEW.profile_id,
          v_message,
          'assignment',
          false,
          v_task_id,
          now()
        );
      end if;
    end if;

  -- Case B: Triggered from `tasks` (INSERT or UPDATE)
  elsif TG_TABLE_NAME = 'tasks' then
    -- Collect all distinct assignees:
    -- 1) tasks.assignee_id (legacy single assignee)
    -- 2) all profile_id entries in public.task_profiles for this task
    for v_recipient_id in
      select distinct u.profile_id from (
        select NEW.assignee_id as profile_id where NEW.assignee_id is not null
        union
        select tp.profile_id from public.task_profiles tp where tp.task_id = v_task_id and tp.profile_id is not null
      ) u
      where exists (
        select 1 from public.profiles p
        where p.id = u.profile_id
          and p.deleted_at is null
          and (p.is_deleted is null or p.is_deleted = false)
      )
    loop
      -- Deduplicate per user
      if not exists (
        select 1 from public.notifications
        where user_id = v_recipient_id
          and related_id = v_task_id
          and created_at > now() - interval '1 minute'
      ) then
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
          v_recipient_id,
          v_message,
          'assignment',
          false,
          v_task_id,
          now()
        );
      end if;
    end loop;
  end if;

  return NEW;
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Set Up Triggers on `public.tasks` and `public.task_profiles`
-- ────────────────────────────────────────────────────────────────────────────

-- Tasks trigger
drop trigger if exists tr_task_assignment_notification on public.tasks;
create trigger tr_task_assignment_notification
  after insert or update of assignee_id, title, project_id
  on public.tasks
  for each row
  execute function public.handle_task_assignment_notification();

-- Task Profiles trigger (for multiple assignees junction table)
drop trigger if exists tr_task_profiles_assignment_notification on public.task_profiles;
drop trigger if exists tr_task_profile_assignment_notification on public.task_profiles;
create trigger tr_task_profiles_assignment_notification
  after insert on public.task_profiles
  for each row
  execute function public.handle_task_assignment_notification();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Trigger Function: handle_notification_webhook (Enhanced for Multi-User Webhooks)
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

  -- Only proceed if recipient has a valid email address
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
        'email', v_user_email,
        'user_id', NEW.user_id
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

    -- 7. Call Edge Function via pg_net (supports net.http_post or extensions.http_post)
    begin
      if exists (
        select 1 from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname = 'net' and p.proname = 'http_post'
      ) then
        perform net.http_post(
          url := v_edge_function_url,
          headers := v_headers,
          body := v_payload,
          timeout_milliseconds := 5000
        );
      elsif exists (
        select 1 from pg_proc p
        join pg_namespace n on p.pronamespace = n.oid
        where n.nspname in ('extensions', 'public') and p.proname = 'http_post'
      ) then
        perform extensions.http_post(
          url := v_edge_function_url,
          headers := v_headers,
          body := v_payload,
          timeout_milliseconds := 5000
        );
      end if;
    exception when others then
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

-- Ensure notification listener trigger is active
drop trigger if exists tr_notifications_webhook_listener on public.notifications;
create trigger tr_notifications_webhook_listener
  after insert on public.notifications
  for each row
  execute function public.handle_notification_webhook();

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Helper Function: notify_task_assignees
--    Allows manual or programmatic multi-user notification for any task
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_task_assignees(
  p_task_id        uuid,
  p_custom_message text default null
)
returns table (
  notification_id uuid,
  user_id         uuid,
  message         text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task_title    text;
  v_project_title text;
  v_final_message text;
  v_rec           uuid;
  v_new_id        uuid;
begin
  select t.title, p.title
  into v_task_title, v_project_title
  from public.tasks t
  left join public.projects p on p.id = t.project_id
  where t.id = p_task_id;

  if v_task_title is null then
    return;
  end if;

  if p_custom_message is not null and p_custom_message <> '' then
    v_final_message := p_custom_message;
  elsif v_project_title is not null and v_project_title <> '' then
    v_final_message := 'You have been assigned to task: "' || v_task_title || '" in project "' || v_project_title || '"';
  else
    v_final_message := 'You have been assigned to task: "' || v_task_title || '"';
  end if;

  for v_rec in
    select distinct u.profile_id from (
      select t.assignee_id as profile_id from public.tasks t where t.id = p_task_id and t.assignee_id is not null
      union
      select tp.profile_id from public.task_profiles tp where tp.task_id = p_task_id and tp.profile_id is not null
    ) u
    where exists (
      select 1 from public.profiles p
      where p.id = u.profile_id
        and p.deleted_at is null
        and (p.is_deleted is null or p.is_deleted = false)
    )
  loop
    v_new_id := gen_random_uuid();
    insert into public.notifications (
      id,
      user_id,
      message,
      type,
      is_read,
      related_id,
      created_at
    ) values (
      v_new_id,
      v_rec,
      v_final_message,
      'assignment',
      false,
      p_task_id,
      now()
    );

    notification_id := v_new_id;
    user_id := v_rec;
    message := v_final_message;
    return next;
  end loop;
end;
$$;

commit;
