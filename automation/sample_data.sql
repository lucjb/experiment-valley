-- Sample data to populate leaderboard for testing
-- Run this in your Supabase SQL Editor

-- Insert sample profiles
INSERT INTO public.profiles (id, display_name, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Alice', now()),
('22222222-2222-2222-2222-222222222222', 'Bob', now()),
('33333333-3333-3333-3333-333333333333', 'Charlie', now()),
('44444444-4444-4444-4444-444444444444', 'Diana', now()),
('55555555-5555-5555-5555-555555555555', 'Eve', now())
ON CONFLICT (id) DO NOTHING;

-- Insert sample sessions
INSERT INTO public.sessions (id, profile_id, started_at, ended_at) VALUES
('s1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', now() - interval '1 day', now() - interval '1 day' + interval '10 minutes'),
('s2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', now() - interval '2 days', now() - interval '2 days' + interval '15 minutes'),
('s3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', now() - interval '3 days', now() - interval '3 days' + interval '8 minutes'),
('s4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', now() - interval '4 days', now() - interval '4 days' + interval '12 minutes'),
('s5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', now() - interval '5 days', now() - interval '5 days' + interval '6 minutes')
ON CONFLICT (id) DO NOTHING;

-- Insert sample session summaries
INSERT INTO public.session_summaries (session_id, profile_id, current_score, max_round_reached, total_impact_cpd, accuracy_pct) VALUES
('s1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 8.5, 5, 12.3, 85.0),
('s2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 7.0, 4, 9.8, 78.0),
('s3333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 6.5, 4, 8.1, 72.0),
('s4444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 5.0, 3, 6.5, 65.0),
('s5555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 4.0, 3, 5.2, 58.0)
ON CONFLICT (session_id) DO NOTHING;
