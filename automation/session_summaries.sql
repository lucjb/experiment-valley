-- Create session_summaries table to track per-session metrics
create table if not exists public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  max_round_reached int not null default 1,
  total_impact_cpd numeric not null default 0,
  accuracy_pct numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(session_id)
);

-- Indexes for performance
create index if not exists idx_session_summaries_profile on public.session_summaries(profile_id);
create index if not exists idx_session_summaries_session on public.session_summaries(session_id);

-- RLS policies
alter table public.session_summaries enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='session_summaries' and policyname='anon insert summaries') then
    create policy "anon insert summaries" on public.session_summaries
    for insert to anon with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='session_summaries' and policyname='anon update summaries') then
    create policy "anon update summaries" on public.session_summaries
    for update to anon using (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='session_summaries' and policyname='anon select summaries') then
    create policy "anon select summaries" on public.session_summaries
    for select to anon using (true);
  end if;
end $$;

-- Update trigger to set updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_session_summaries_updated_at
  before update on public.session_summaries
  for each row execute function update_updated_at_column();
