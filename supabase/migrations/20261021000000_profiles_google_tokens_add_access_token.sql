-- Migration: Add access_token and access_token_expire to public.profiles_google_tokens
-- Purpose: Cache and reuse OAuth 2.0 access tokens to avoid excessive refresh token exchanges.
-- Frequent refresh token exchanges can cause Google to rotate/revoke tokens or return invalid_grant errors.

-- 1. Add access_token and access_token_expire columns
ALTER TABLE public.profiles_google_tokens
  ADD COLUMN IF NOT EXISTS access_token TEXT,
  ADD COLUMN IF NOT EXISTS access_token_expire TIMESTAMPTZ;

-- 2. Add comments explaining token lifecycle and caching rules
COMMENT ON COLUMN public.profiles_google_tokens.access_token IS 
  'Cached Google Workspace OAuth 2.0 access token used for direct Google REST API calls.';

COMMENT ON COLUMN public.profiles_google_tokens.access_token_expire IS 
  'UTC expiration timestamp of the cached access_token. If NULL or expired, Rabbit must regenerate using google_refresh_token and update this table. If valid and not expired, Rabbit must reuse access_token.';

-- 3. Create index on access_token_expire for rapid expiration checks
CREATE INDEX IF NOT EXISTS idx_profiles_google_tokens_expire 
  ON public.profiles_google_tokens (access_token_expire);
