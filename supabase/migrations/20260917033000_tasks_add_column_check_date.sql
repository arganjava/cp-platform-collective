-- Alter table tasks to add column check_date
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS check_date DATE;
