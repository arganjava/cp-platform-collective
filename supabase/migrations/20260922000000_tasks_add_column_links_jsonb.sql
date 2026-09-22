-- Migration: Add links JSONB column to tasks table and migrate existing link data
-- 
-- ARCHITECTURAL COMPARISON: JSONB vs Separate `task_links` Table:
--
-- Why JSONB is better for this use case:
-- 1. Atomic reads & updates: All links are read and saved together with the task in a single SQL operation.
--    No risk of partial failure (e.g. task saved but link inserts fail).
-- 2. Eliminates 1-to-many transaction overhead & orphan rows: Deleting or duplicating a task doesn't require
--    cascading delete triggers or complex multi-table joins.
-- 3. Security (RLS): Inherits tasks' existing Row-Level Security (RLS) policies directly without requiring
--    duplicate RLS policies on a child table.
-- 4. Supabase & Client State: Allows seamless single-table fetching in fetchTeamData() and keeps Zustand store
--    clean and fast without extra relational join logic.
--
-- (If links needed their own independent access control, foreign keys from other tables, or independent querying across
-- all tasks, a separate table would be considered; but for labeled metadata URLs belonging exclusively to a task,
-- JSONB is standard practice in modern Postgres + Supabase applications).

-- 1. Add links column as JSONB with default empty array
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;

-- 2. Migrate existing non-empty `link` values into the new `links` JSONB array
UPDATE public.tasks
SET links = jsonb_build_array(
  jsonb_build_object(
    'id', 'link-1',
    'label', 'Link',
    'url', TRIM(link)
  )
)
WHERE link IS NOT NULL 
  AND TRIM(link) <> '' 
  AND (links IS NULL OR links = '[]'::jsonb);

-- 3. Add GIN index for fast querying and indexing within the JSONB array
CREATE INDEX IF NOT EXISTS idx_tasks_links ON public.tasks USING gin (links);
