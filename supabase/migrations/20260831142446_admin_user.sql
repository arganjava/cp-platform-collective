-- ============================================================================
-- CP Platform — Provision a password-based admin user (no Google OAuth)
-- ----------------------------------------------------------------------------
-- Why: the app signs in via Google by default, but a deterministic
-- email/password account is far easier for automated tests (Playwright) and
-- for staff who don't use an @collectivep.com Google account. This script
-- creates one directly in the auth schema, marks the email as confirmed (no
-- inbox required), creates the matching auth.identities row (GoTrue needs it
-- for password sign-in), lets the existing `handle_new_user` trigger create
-- the team profile, then promotes that profile to `admin`.
--
-- Gotchas with direct auth.users inserts, all handled here:
--   1. Supabase only defines a *partial* unique index on auth.users(email)
--      (WHERE deleted_at IS NULL), so `ON CONFLICT (email)` is rejected
--      (42P10) — we look the user up explicitly instead.
--   2. GoTrue expects the token/change columns to be empty strings, NOT NULL.
--      A NULL makes sign-in fail with "500: Database error querying schema"
--      ("converting NULL to string is unsupported"). The insert sets them to
--      '' and the update branch repairs any NULLs on an existing user.
--   3. A user inserted straight into auth.users has NO row in auth.identities
--      (the dashboard shows "Providers: blank"). GoTrue resolves the
--      email/password provider through auth.identities, so without it the
--      login fails. This script inserts the identity on create and repairs/
--      re-asserts it on re-run.
--
-- How to run:
--   1. Supabase Dashboard → SQL Editor → New query → paste → Run.
--      If you already ran a version that created the user, just RE-RUN this
--      script — it repairs the row (tokens + identity) and rotates the
--      password. This is required: an existing-but-broken row is not fixed
--      until this script runs against it.
--   2. Sign in at /login with "Sign in with email":
--        email:    admin@collectivep.com
--        password: CPAdmin2026!
--   3. Change the password afterwards (Dashboard → Authentication → Users,
--      or edit the PASSWORD constant below and re-run).
--
-- Safe to re-run: an existing user gets the password rotated, NULL token
-- columns repaired, the email identity re-asserted, and the profile upsert
-- re-asserts the admin role.
-- ============================================================================
create extension if not exists pgcrypto with schema extensions;
do $$
declare
  v_admin_email text := 'admin@collectivep.com';
  v_encrypted_password text := extensions.crypt('CPAdmin2026!', extensions.gen_salt('bf'));
  v_user_id uuid;
  v_identity_id uuid;
begin
  -- 1) Find an existing auth user by email, or create one.
  select id into v_user_id
  from auth.users
  where email = v_admin_email
  limit 1;

  if v_user_id is null then
    -- 1a) Create the auth user. Email is confirmed so no inbox verification is
    --     needed. Token/change columns are '' (NOT NULL) — NULL here breaks
    --     GoTrue sign-in with "Database error querying schema".
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new,
      email_change_token_current, phone_change_token, reauthentication_token,
      email_change,
      created_at, updated_at
    )
    values (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      v_admin_email,
      v_encrypted_password,
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"name":"CP Admin"}',
      '', '', '', '', '', '', '',
      now(),
      now()
    )
    returning id into v_user_id;
  else
    -- 1b) Existing user: rotate the password, ensure the email is confirmed,
    --     and repair any NULL token/change columns (the GoTrue scan fix).
    update auth.users
    set encrypted_password = v_encrypted_password,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = '{"provider":"email","providers":["email"]}',
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        email_change = coalesce(email_change, ''),
        updated_at = now()
    where id = v_user_id;
  end if;

  -- 2) Ensure the email identity exists (GoTrue needs it for password
  --    sign-in; the dashboard shows it as Providers: email). Covers both a
  --    brand-new user and a pre-existing one created without an identity.
  select id into v_identity_id
  from auth.identities
  where provider = 'email' and user_id = v_user_id
  limit 1;

  if v_identity_id is null then
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    )
    values (
      gen_random_uuid(),
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_admin_email),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.identities
    set identity_data = jsonb_build_object('sub', v_user_id::text, 'email', v_admin_email),
        provider_id = v_user_id,
        updated_at = now()
    where id = v_identity_id;
  end if;

  -- 3) Make sure the team profile exists and carries the admin role
  --    (covers both the just-created user and a pre-existing one whose
  --    profile was never created because the trigger was added later).
  insert into public.profiles (auth_user_id, name, email, avatar_color, role)
  values (v_user_id, 'CP Admin', v_admin_email, 'var(--primary)', 'admin')
  on conflict (auth_user_id)
  do update set role = 'admin', name = 'CP Admin';
end $$;