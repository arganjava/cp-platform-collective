-- Migration: Add profiles.google_oauth and create profiles_google_tokens table
-- Enables users to upload client_secret_*.json and store OAuth tokens for Google Workspace

-- 1. Add google_oauth JSONB column to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_oauth JSONB;
COMMENT ON COLUMN public.profiles.google_oauth IS 'Google OAuth client configuration (client_secret_*.json) uploaded by team member';

-- 2. Create public.profiles_google_tokens table
CREATE TABLE IF NOT EXISTS public.profiles_google_tokens (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  google_client_id     TEXT,
  google_client_secret TEXT,
  google_refresh_token TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_profiles_google_tokens_profile UNIQUE (profile_id)
);

COMMENT ON TABLE public.profiles_google_tokens IS 'Stores Google Workspace OAuth tokens (client_id, client_secret, refresh_token) linked to team profiles';
COMMENT ON COLUMN public.profiles_google_tokens.google_refresh_token IS 'OAuth 2.0 refresh token used for offline Google Workspace API access';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_google_tokens_profile_id ON public.profiles_google_tokens (profile_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles_google_tokens ENABLE ROW LEVEL SECURITY;

-- Select policy: User can view their own tokens, or workspace admins can view
DROP POLICY IF EXISTS "profiles_google_tokens_select" ON public.profiles_google_tokens;
CREATE POLICY "profiles_google_tokens_select" ON public.profiles_google_tokens
  FOR SELECT TO authenticated
  USING (
    profile_id = auth.uid() OR
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (id = auth.uid() OR auth_user_id = auth.uid()) AND role = 'admin'
    )
  );

-- Insert policy: User can insert for their own profile, or admin can insert
DROP POLICY IF EXISTS "profiles_google_tokens_insert" ON public.profiles_google_tokens;
CREATE POLICY "profiles_google_tokens_insert" ON public.profiles_google_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid() OR
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (id = auth.uid() OR auth_user_id = auth.uid()) AND role = 'admin'
    )
  );

-- Update policy: User can update their own tokens, or admin can update
DROP POLICY IF EXISTS "profiles_google_tokens_update" ON public.profiles_google_tokens;
CREATE POLICY "profiles_google_tokens_update" ON public.profiles_google_tokens
  FOR UPDATE TO authenticated
  USING (
    profile_id = auth.uid() OR
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (id = auth.uid() OR auth_user_id = auth.uid()) AND role = 'admin'
    )
  );

-- Delete policy: User can delete their own tokens, or admin can delete
DROP POLICY IF EXISTS "profiles_google_tokens_delete" ON public.profiles_google_tokens;
CREATE POLICY "profiles_google_tokens_delete" ON public.profiles_google_tokens
  FOR DELETE TO authenticated
  USING (
    profile_id = auth.uid() OR
    profile_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE (id = auth.uid() OR auth_user_id = auth.uid()) AND role = 'admin'
    )
  );
