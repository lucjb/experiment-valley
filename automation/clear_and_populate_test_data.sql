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
DELETE FROM public.profiles;

-- Reset sequences
ALTER SEQUENCE IF EXISTS public.profiles_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS public.sessions_id_seq RESTART WITH 1;

-- Insert 100 test profiles with varied names and timestamps
-- Note: Some names are intentionally duplicated to test collision handling
INSERT INTO public.profiles (id, display_name, created_at) VALUES
-- Top performers (1-20) - Some with duplicate names to test collision handling
('11111111-1111-1111-1111-111111111111', 'Alice', now() - interval '30 days'),
('22222222-2222-2222-2222-222222222222', 'Bob', now() - interval '29 days'),
('33333333-3333-3333-3333-333333333333', 'Charlie', now() - interval '28 days'),
('44444444-4444-4444-4444-444444444444', 'Diana', now() - interval '27 days'),
('55555555-5555-5555-5555-555555555555', 'Eve', now() - interval '26 days'),
('66666666-6666-6666-6666-666666666666', 'Frank', now() - interval '25 days'),
('77777777-7777-7777-7777-777777777777', 'Grace', now() - interval '24 days'),
('88888888-8888-8888-8888-888888888888', 'Henry', now() - interval '23 days'),
('99999999-9999-9999-9999-999999999999', 'Ivy', now() - interval '22 days'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Jack', now() - interval '21 days'),
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kate', now() - interval '20 days'),
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Liam', now() - interval '19 days'),
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Maya', now() - interval '18 days'),
('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Noah', now() - interval '17 days'),
('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Olivia', now() - interval '16 days'),
('00000000-0000-0000-0000-000000000001', 'Paul', now() - interval '15 days'),
('00000000-0000-0000-0000-000000000002', 'Quinn', now() - interval '14 days'),
('00000000-0000-0000-0000-000000000003', 'Ruby', now() - interval '13 days'),
('00000000-0000-0000-0000-000000000004', 'Sam', now() - interval '12 days'),
('00000000-0000-0000-0000-000000000005', 'Tina', now() - interval '11 days'),
-- Good performers (21-50) - Including some duplicate names to test collision handling
('00000000-0000-0000-0000-000000000006', 'Alice', now() - interval '10 days'), -- Duplicate name
('00000000-0000-0000-0000-000000000007', 'Victor', now() - interval '9 days'),
('00000000-0000-0000-0000-000000000008', 'Wendy', now() - interval '8 days'),
('00000000-0000-0000-0000-000000000009', 'Xavier', now() - interval '7 days'),
('00000000-0000-0000-0000-00000000000a', 'Yara', now() - interval '6 days'),
('00000000-0000-0000-0000-00000000000b', 'Zoe', now() - interval '5 days'),
('00000000-0000-0000-0000-00000000000c', 'Alex', now() - interval '4 days'),
('00000000-0000-0000-0000-00000000000d', 'Beth', now() - interval '3 days'),
('00000000-0000-0000-0000-00000000000e', 'Carl', now() - interval '2 days'),
('00000000-0000-0000-0000-00000000000f', 'Dana', now() - interval '1 day'),
('00000000-0000-0000-0000-000000000010', 'Eric', now() - interval '23 hours'),
('00000000-0000-0000-0000-000000000011', 'Fiona', now() - interval '22 hours'),
('00000000-0000-0000-0000-000000000012', 'Gary', now() - interval '21 hours'),
('00000000-0000-0000-0000-000000000013', 'Helen', now() - interval '20 hours'),
('00000000-0000-0000-0000-000000000014', 'Ian', now() - interval '19 hours'),
('00000000-0000-0000-0000-000000000015', 'Jill', now() - interval '18 hours'),
('00000000-0000-0000-0000-000000000016', 'Kyle', now() - interval '17 hours'),
('00000000-0000-0000-0000-000000000017', 'Lisa', now() - interval '16 hours'),
('00000000-0000-0000-0000-000000000018', 'Mike', now() - interval '15 hours'),
('00000000-0000-0000-0000-000000000019', 'Nina', now() - interval '14 hours'),
('00000000-0000-0000-0000-00000000001a', 'Oscar', now() - interval '13 hours'),
('00000000-0000-0000-0000-00000000001b', 'Paula', now() - interval '12 hours'),
('00000000-0000-0000-0000-00000000001c', 'Quinn', now() - interval '11 hours'),
('00000000-0000-0000-0000-00000000001d', 'Rita', now() - interval '10 hours'),
('00000000-0000-0000-0000-00000000001e', 'Steve', now() - interval '9 hours'),
('00000000-0000-0000-0000-00000000001f', 'Tara', now() - interval '8 hours'),
('00000000-0000-0000-0000-000000000020', 'Ugo', now() - interval '7 hours'),
('00000000-0000-0000-0000-000000000021', 'Vera', now() - interval '6 hours'),
('00000000-0000-0000-0000-000000000022', 'Will', now() - interval '5 hours'),
('00000000-0000-0000-0000-000000000023', 'Xara', now() - interval '4 hours'),
-- Average performers (51-80) - Including more duplicate names
('00000000-0000-0000-0000-000000000024', 'Yuki', now() - interval '3 hours'),
('00000000-0000-0000-0000-000000000025', 'Zack', now() - interval '2 hours'),
('00000000-0000-0000-0000-000000000026', 'Amy', now() - interval '1 hour'),
('00000000-0000-0000-0000-000000000027', 'Ben', now() - interval '30 minutes'),
('00000000-0000-0000-0000-000000000028', 'Cara', now() - interval '25 minutes'),
('00000000-0000-0000-0000-000000000029', 'Dan', now() - interval '20 minutes'),
('00000000-0000-0000-0000-00000000002a', 'Eva', now() - interval '15 minutes'),
('00000000-0000-0000-0000-00000000002b', 'Finn', now() - interval '10 minutes'),
('00000000-0000-0000-0000-00000000002c', 'Gina', now() - interval '5 minutes'),
('00000000-0000-0000-0000-00000000002d', 'Hugo', now() - interval '4 minutes'),
('00000000-0000-0000-0000-00000000002e', 'Iris', now() - interval '3 minutes'),
('00000000-0000-0000-0000-00000000002f', 'Jake', now() - interval '2 minutes'),
('00000000-0000-0000-0000-000000000030', 'Kira', now() - interval '1 minute'),
('00000000-0000-0000-0000-000000000031', 'Leo', now() - interval '30 seconds'),
('00000000-0000-0000-0000-000000000032', 'Mia', now() - interval '20 seconds'),
('00000000-0000-0000-0000-000000000033', 'Nick', now() - interval '10 seconds'),
('00000000-0000-0000-0000-000000000034', 'Ola', now() - interval '5 seconds'),
('00000000-0000-0000-0000-000000000035', 'Pete', now() - interval '1 second'),
('00000000-0000-0000-0000-000000000036', 'Quin', now()),
('00000000-0000-0000-0000-000000000037', 'Rosa', now()),
('00000000-0000-0000-0000-000000000038', 'Seth', now()),
('00000000-0000-0000-0000-000000000039', 'Tina', now()),
('00000000-0000-0000-0000-00000000003a', 'Ugo', now()),
('00000000-0000-0000-0000-00000000003b', 'Vera', now()),
('00000000-0000-0000-0000-00000000003c', 'Wade', now()),
('00000000-0000-0000-0000-00000000003d', 'Xara', now()),
('00000000-0000-0000-0000-00000000003e', 'Yuki', now()),
('00000000-0000-0000-0000-00000000003f', 'Zack', now()),
('00000000-0000-0000-0000-000000000040', 'Aria', now()),
-- Struggling performers (81-100) - Including duplicate names to test collision handling
('00000000-0000-0000-0000-000000000041', 'Blake', now()),
('00000000-0000-0000-0000-000000000042', 'Cora', now()),
('00000000-0000-0000-0000-000000000043', 'Drew', now()),
('00000000-0000-0000-0000-000000000044', 'Emma', now()),
('00000000-0000-0000-0000-000000000045', 'Finn', now()),
('00000000-0000-0000-0000-000000000046', 'Gina', now()),
('00000000-0000-0000-0000-000000000047', 'Hugo', now()),
('00000000-0000-0000-0000-000000000048', 'Iris', now()),
('00000000-0000-0000-0000-000000000049', 'Jake', now()),
('00000000-0000-0000-0000-00000000004a', 'Kira', now()),
('00000000-0000-0000-0000-00000000004b', 'Leo', now()),
('00000000-0000-0000-0000-00000000004c', 'Mia', now()),
('00000000-0000-0000-0000-00000000004d', 'Nick', now()),
('00000000-0000-0000-0000-00000000004e', 'Ola', now()),
('00000000-0000-0000-0000-00000000004f', 'Pete', now()),
('00000000-0000-0000-0000-000000000050', 'Quin', now()),
('00000000-0000-0000-0000-000000000051', 'Rosa', now()),
('00000000-0000-0000-0000-000000000052', 'Seth', now()),
('00000000-0000-0000-0000-000000000053', 'Tina', now()),
('00000000-0000-0000-0000-000000000054', 'Ugo', now()),
('00000000-0000-0000-0000-000000000055', 'Vera', now()),
-- Additional duplicate names to test collision handling
('00000000-0000-0000-0000-000000000056', 'Alice', now()), -- Another Alice
('00000000-0000-0000-0000-000000000057', 'Bob', now()), -- Another Bob
('00000000-0000-0000-0000-000000000058', 'Charlie', now()); -- Another Charlie

-- NOTE: This file contains a sample of 100 users. For the complete dataset, 
-- run: node generate_100_users.js > 100_users_complete.sql
-- Then copy the INSERT statements from that file to replace the sections below.

-- Insert 100 test sessions (sample - see note above for complete data)
INSERT INTO public.sessions (id, profile_id, started_at, ended_at) VALUES
-- Top performers (1-20) - High rounds, high impact, high accuracy
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', now() - interval '30 days', now() - interval '30 days' + interval '20 minutes'),
('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', now() - interval '29 days', now() - interval '29 days' + interval '18 minutes'),
('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', now() - interval '28 days', now() - interval '28 days' + interval '22 minutes'),
('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', now() - interval '27 days', now() - interval '27 days' + interval '19 minutes'),
('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', now() - interval '26 days', now() - interval '26 days' + interval '21 minutes'),
-- Good performers (21-50) - Medium rounds, medium impact, good accuracy
('66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', now() - interval '25 days', now() - interval '25 days' + interval '15 minutes'),
('77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', now() - interval '24 days', now() - interval '24 days' + interval '16 minutes'),
('88888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', now() - interval '23 days', now() - interval '23 days' + interval '14 minutes'),
-- Average performers (51-80) - Lower rounds, lower impact, average accuracy
('99999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', now() - interval '22 days', now() - interval '22 days' + interval '12 minutes'),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', now() - interval '21 days', now() - interval '21 days' + interval '10 minutes'),
-- Struggling performers (81-100) - Very low rounds, very low impact, poor accuracy
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000041', now() - interval '20 days', now() - interval '20 days' + interval '8 minutes'),
('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000042', now() - interval '19 days', now() - interval '19 days' + interval '6 minutes'),
-- ... (continuing with all 100 sessions - see 100_users_complete.sql for full data)
('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000055', now() - interval '1 day', now() - interval '1 day' + interval '5 minutes');

-- Insert 100 test session summaries with opponent information (sample - see note above for complete data)
INSERT INTO public.session_summaries (session_id, profile_id, max_round_reached, total_impact_cpd, accuracy_pct, opponent_name, opponent_impact_cpd) VALUES
-- Top performers (1-20) - High performance data
('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 6, 15.2, 95, 'HiPPO', 3.1),
('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 5, 14.8, 92, 'Random', 2.8),
('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 6, 13.5, 89, 'Naive', 4.2),
('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444', 5, 12.9, 87, 'HiPPO', 2.5),
('55555555-5555-5555-5555-555555555555', '55555555-5555-5555-5555-555555555555', 5, 12.1, 85, 'Random', 3.7),
-- Good performers (21-50) - Medium performance data
('66666666-6666-6666-6666-666666666666', '66666666-6666-6666-6666-666666666666', 4, 8.5, 78, 'HiPPO', 4.1),
('77777777-7777-7777-7777-777777777777', '77777777-7777-7777-7777-777777777777', 4, 7.9, 75, 'Naive', 3.8),
('88888888-8888-8888-8888-888888888888', '88888888-8888-8888-8888-888888888888', 3, 7.2, 72, 'Random', 4.5),
-- Average performers (51-80) - Lower performance data
('99999999-9999-9999-9999-999999999999', '99999999-9999-9999-9999-999999999999', 3, 4.8, 65, 'HiPPO', 5.2),
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2, 4.1, 58, 'Naive', 4.8),
-- Struggling performers (81-100) - Very low performance data
('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000041', 1, 2.3, 45, 'Random', 6.1),
('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000042', 0, 1.8, 38, 'HiPPO', 7.4),
-- ... (continuing with all 100 session summaries - see 100_users_complete.sql for full data)
('00000000-0000-0000-0000-000000000055', '00000000-0000-0000-0000-000000000055', 0, 0.5, 25, 'Naive', 8.9);


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
