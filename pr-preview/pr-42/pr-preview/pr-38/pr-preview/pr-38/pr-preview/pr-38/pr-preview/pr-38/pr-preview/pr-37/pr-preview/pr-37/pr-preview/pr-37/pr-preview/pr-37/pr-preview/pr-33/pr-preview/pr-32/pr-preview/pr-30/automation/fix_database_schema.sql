-- Fix database schema after removing points system
-- Run this in your Supabase SQL Editor

-- Remove current_score column from session_summaries if it exists
ALTER TABLE public.session_summaries DROP COLUMN IF EXISTS current_score;

-- Remove scores table if it exists
DROP TABLE IF EXISTS public.scores;

-- Update session_summaries to ensure it has the correct columns
-- (This will fail if columns don't exist, which is fine)
DO $$ 
BEGIN
    -- Add columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_summaries' AND column_name = 'max_round_reached') THEN
        ALTER TABLE public.session_summaries ADD COLUMN max_round_reached integer DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_summaries' AND column_name = 'total_impact_cpd') THEN
        ALTER TABLE public.session_summaries ADD COLUMN total_impact_cpd numeric DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_summaries' AND column_name = 'accuracy_pct') THEN
        ALTER TABLE public.session_summaries ADD COLUMN accuracy_pct numeric DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_summaries' AND column_name = 'opponent_name') THEN
        ALTER TABLE public.session_summaries ADD COLUMN opponent_name text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'session_summaries' AND column_name = 'opponent_impact_cpd') THEN
        ALTER TABLE public.session_summaries ADD COLUMN opponent_impact_cpd numeric DEFAULT 0;
    END IF;
END $$;

-- Verify the final schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'session_summaries' 
AND table_schema = 'public'
ORDER BY ordinal_position;
