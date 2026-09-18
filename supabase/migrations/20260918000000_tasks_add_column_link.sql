-- Alter table tasks to add column link
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS link TEXT;
