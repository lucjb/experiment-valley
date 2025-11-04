-- Add opponent columns to session_summaries table
-- Run this in your Supabase SQL Editor

-- Add opponent_name column
ALTER TABLE public.session_summaries 
ADD COLUMN IF NOT EXISTS opponent_name text;

-- Add opponent_impact_cpd column  
ALTER TABLE public.session_summaries 
ADD COLUMN IF NOT EXISTS opponent_impact_cpd numeric DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_summaries_opponent 
ON public.session_summaries(opponent_name);

-- Update existing records to have default values
UPDATE public.session_summaries 
SET opponent_impact_cpd = 0 
WHERE opponent_impact_cpd IS NULL;
