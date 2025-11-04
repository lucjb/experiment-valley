-- Remove score-related fields from database
-- Run this in your Supabase SQL Editor

-- Remove current_score column from session_summaries if it exists
ALTER TABLE public.session_summaries DROP COLUMN IF EXISTS current_score;

-- Remove scores table if it exists
DROP TABLE IF EXISTS public.scores;

-- Verify the changes
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'session_summaries' 
AND table_schema = 'public'
ORDER BY ordinal_position;
