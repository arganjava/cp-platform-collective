-- Ensure profiles.email is unique (case-insensitive and trimmed)
create unique index if not exists idx_profiles_email_unique on public.profiles (lower(trim(email)));
