-- Sample day-by-day ranking data for the Profile Statistics / SRS Overview
-- reports — see migration 0003_profile_stats.sql and
-- src/lib/reports/knowledge.ts for why this is seeded rather than real.
-- Safe to re-run (deletes first).
--
-- Now covers every seeded profile (not just 3) so SRS Overview — which
-- shows one row per agent, using the LATEST snapshot per profile — has
-- enough agents to be worth charting. Split into two realistic bands,
-- matching the real report's sample data: most agents have near-zero
-- engagement (a handful of profile views, no reviews/social/listings
-- activity), and a few are genuinely active, exactly like the real
-- production export attached to this app's build history (most rows
-- score 55-70 with all-zero category points; a few score 100-250+ with
-- real activity across categories).
--
-- random()/floor() calls live in the outer SELECT list, not inside a
-- LATERAL subquery — see supabase/seed_reports.sql for why that matters.

delete from public.profile_daily_stats
where profile_id in (select id from public.profiles);

with active_profiles as (
  select id, name from public.profiles
  where name in ('Taylor Alison', 'Wei Chen', 'Priya Subramaniam', 'Grace Lindqvist', 'Marcus Reyes')
),
quiet_profiles as (
  select id, name from public.profiles
  where name not in ('Taylor Alison', 'Wei Chen', 'Priya Subramaniam', 'Grace Lindqvist', 'Marcus Reyes')
),
days as (
  select generate_series(0, 29) as offset_days
)
insert into public.profile_daily_stats (
  profile_id, stat_date, location_rank, profile_views,
  profile_completion_points, review_reply_points, connections_points, listings_points, web_analytics_points,
  total_experience_score, top_5_percent
)
select
  p.id,
  (current_date - d.offset_days),
  (1 + floor(random() * 25))::int,
  (5 + floor(random() * 60))::int,
  (50 + floor(random() * 25))::int,
  (5 + floor(random() * 25))::int,
  (5 + floor(random() * 20))::int,
  (0 + floor(random() * 10))::int,
  (10 + floor(random() * 150))::int,
  round((3.6 + random() * 1.4)::numeric, 2),
  random() < 0.3
from active_profiles p
cross join days d

union all

select
  p.id,
  (current_date - d.offset_days),
  (1 + floor(random() * 95))::int,
  floor(random() * 4)::int,
  (50 + floor(random() * 20))::int,
  0,
  0,
  0,
  0,
  0,
  false
from quiet_profiles p
cross join days d;
