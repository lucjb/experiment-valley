-- Clear database and populate with test data including opponent information
-- Run this in your Supabase SQL Editor

-- First, run the opponent columns migration if not already done
ALTER TABLE public.session_summaries 
ADD COLUMN IF NOT EXISTS opponent_name text;

ALTER TABLE public.session_summaries 
ADD COLUMN IF NOT EXISTS opponent_impact_cpd numeric DEFAULT 0;

-- Clear existing data (in correct order due to foreign key constraints)
DELETE FROM public.session_summaries;
DELETE FROM public.sessions;
DELETE FROM public.scores;
DELETE FROM public.profiles;

-- Reset sequences
ALTER SEQUENCE IF EXISTS public.profiles_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.sessions_id_seq RESTART WITH 1;

-- Insert test profiles
INSERT INTO public.profiles (id, display_name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Alice', now() - interval '5 days'),
('22222222-2222-2222-2222-222222222222', 'Bob', now() - interval '4 days'),
('33333333-3333-3333-3333-333333333333', 'Charlie', now() - interval '3 days'),
('44444444-4444-4444-4444-444444444444', 'Diana', now() - interval '2 days'),
('55555555-5555-5555-5555-555555555555', 'Eve', now() - interval '1 day'),
('66666666-6666-6666-6666-666666666666', 'Frank', now() - interval '6 hours'),
('77777777-7777-7777-7777-777777777777', 'Grace', now() - interval '3 hours'),
('88888888-8888-8888-8888-888888888888', 'Henry', now() - interval '1 hour');

-- Insert test sessions
INSERT INTO public.sessions (id, profile_id, started_at, ended_at) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', now() - interval '5 days', now() - interval '5 days' + interval '15 minutes'),
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', now() - interval '4 days', now() - interval '4 days' + interval '12 minutes'),
('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', now() - interval '3 days', now() - interval '3 days' + interval '18 minutes'),
('a4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', now() - interval '2 days', now() - interval '2 days' + interval '10 minutes'),
('a5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', now() - interval '1 day', now() - interval '1 day' + interval '8 minutes'),
('a6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', now() - interval '6 hours', now() - interval '6 hours' + interval '14 minutes'),
('a7777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', now() - interval '3 hours', now() - interval '3 hours' + interval '11 minutes'),
('a8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', now() - interval '1 hour', now() - interval '1 hour' + interval '9 minutes');

-- Insert test session summaries with opponent information
INSERT INTO public.session_summaries (session_id, profile_id, current_score, max_round_reached, total_impact_cpd, accuracy_pct, opponent_name, opponent_impact_cpd) VALUES
-- Alice - High performer vs HiPPO
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 8.5, 5, 12.3, 85.0, 'HiPPO', 6.2),

-- Bob - Good performer vs Random
('a2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 7.0, 4, 9.8, 78.0, 'Random', 4.1),

-- Charlie - Decent performer vs Naive
('a3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 6.5, 4, 8.1, 72.0, 'Naive', 5.3),

-- Diana - Moderate performer vs HiPPO
('a4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 5.0, 3, 6.5, 65.0, 'HiPPO', 7.8),

-- Eve - Struggling performer vs Random
('a5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 4.0, 3, 5.2, 58.0, 'Random', 8.9),

-- Frank - New player vs Naive
('a6666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', 3.5, 2, 4.1, 52.0, 'Naive', 6.7),

-- Grace - Recent player vs HiPPO
('a7777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', 2.8, 1, 3.2, 45.0, 'HiPPO', 9.1),

-- Henry - Latest player vs Random
('a8888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', 1.5, 0, 1.8, 38.0, 'Random', 7.4);

-- Insert some additional scores for variety
INSERT INTO public.scores (profile_id, score) VALUES
('11111111-1111-1111-1111-111111111111', 8.5),
('11111111-1111-1111-1111-111111111111', 7.2),
('22222222-2222-2222-2222-222222222222', 7.0),
('22222222-2222-2222-2222-222222222222', 6.8),
('33333333-3333-3333-3333-333333333333', 6.5),
('44444444-4444-4444-4444-444444444444', 5.0),
('55555555-5555-5555-5555-555555555555', 4.0),
('66666666-6666-6666-6666-666666666666', 3.5),
('77777777-7777-7777-7777-777777777777', 2.8),
('88888888-8888-8888-8888-888888888888', 1.5);

-- Verify the data
SELECT 
    p.display_name,
    s.max_round_reached,
    s.total_impact_cpd,
    s.accuracy_pct,
    s.opponent_name,
    s.opponent_impact_cpd
FROM public.session_summaries s
JOIN public.profiles p ON s.profile_id = p.id
ORDER BY s.total_impact_cpd DESC;
