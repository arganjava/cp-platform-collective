-- Migration: Schedule Google Workspace Token Refresh Cron Every 5 Minutes
-- Creates database trigger function and pg_cron schedule to call schedule-refresh-google-tokens Edge Function.
-- Ensures profiles_google_tokens.access_token is perpetually valid and unexpired.
-- Rabbit AI Agent can then simply look at profiles_google_tokens.access_token without running OAuth refresh flows.

-- 1. Ensure required extensions (pg_net for HTTP calls, pg_cron for scheduling)
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the trigger function that calls the schedule-refresh-google-tokens Edge Function
CREATE OR REPLACE FUNCTION public.trigger_refresh_google_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_base_url text;
  v_service_key text;
  v_edge_function_url text;
  v_headers jsonb;
  v_request_id bigint;
BEGIN
  -- Fetch BASE_URL and SERVICE_ROLE_KEY from public.app_config
  SELECT value INTO v_base_url
  FROM public.app_config
  WHERE key IN ('BASE_URL', 'base_url')
  LIMIT 1;

  SELECT value INTO v_service_key
  FROM public.app_config
  WHERE key IN ('SERVICE_ROLE_KEY', 'service_role_key')
  LIMIT 1;

  -- Default fallback if base_url not populated
  IF v_base_url IS NULL OR v_base_url = '' THEN
    v_base_url := 'http://127.0.0.1:54321';
  END IF;

  -- Construct the Edge Function URL
  IF v_base_url LIKE '%/functions/v1%' THEN
    v_edge_function_url := rtrim(v_base_url, '/') || '/schedule-refresh-google-tokens';
  ELSE
    v_edge_function_url := rtrim(v_base_url, '/') || '/functions/v1/schedule-refresh-google-tokens';
  END IF;

  -- Prepare headers
  IF v_service_key IS NOT NULL AND v_service_key <> '' THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    );
  ELSE
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json'
    );
  END IF;

  -- Invoke Edge Function via pg_net (net.http_post or extensions.http_post)
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'net' AND p.proname = 'http_post'
  ) THEN
    PERFORM net.http_post(
      url := v_edge_function_url,
      headers := v_headers,
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now()),
      timeout_milliseconds := 15000
    );
  ELSIF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname IN ('extensions', 'public') AND p.proname = 'http_post'
  ) THEN
    PERFORM extensions.http_post(
      url := v_edge_function_url,
      headers := v_headers,
      body := jsonb_build_object('source', 'pg_cron', 'scheduled_at', now()),
      timeout_milliseconds := 15000
    );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trigger_refresh_google_tokens encountered error: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.trigger_refresh_google_tokens() IS 
  'Triggers schedule-refresh-google-tokens Edge Function via pg_net every 5 minutes to maintain fresh Google Workspace access tokens.';

-- 3. Register the 5-minute pg_cron job
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'cron') THEN
    -- Unschedule existing job if already registered to avoid duplicates
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-google-tokens-every-5-mins') THEN
      PERFORM cron.unschedule('refresh-google-tokens-every-5-mins');
    END IF;

    -- Schedule job to run every 5 minutes (*/5 * * * *)
    PERFORM cron.schedule(
      'refresh-google-tokens-every-5-mins',
      '*/5 * * * *',
      'SELECT public.trigger_refresh_google_tokens();'
    );
  ELSE
    RAISE NOTICE 'pg_cron extension not installed or active in current schema; job will be scheduled once pg_cron is enabled.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron setup note: %', SQLERRM;
END $$;
