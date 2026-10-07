-- Migration: Add wa_number to public.profiles table
-- For Rabbit Agent WhatsApp mobile identification and RBAC authorization

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wa_number TEXT;
COMMENT ON COLUMN public.profiles.wa_number IS 'WhatsApp mobile phone number used for Rabbit WhatsApp agent identification and role verification (admin, member, guest)';

CREATE INDEX IF NOT EXISTS idx_profiles_wa_number ON public.profiles (wa_number);
