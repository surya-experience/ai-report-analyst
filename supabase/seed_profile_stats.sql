-- Sample day-by-day ranking data for the Profile Statistics report — see
-- migration 0003_profile_stats.sql and src/lib/reports/knowledge.ts for why
-- this is seeded rather than real. Safe to re-run (deletes first).
-- random()/floor() calls live in the outer SELECT list, not inside a
-- LATERAL subquery — see supabase/seed_reports.sql for why that matters.

delete from public.profile_daily_stats
where profile_id in (
  select id from public.profiles where name in ('Taylor Alison', 'Wei Chen', 'Priya Subramaniam')
);

with target_profiles as (
  select id, name from public.profiles where name in ('Taylor Alison', 'Wei Chen', 'Priya Subramaniam')
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
  (10 + floor(random() * 20))::int,
  (5 + floor(random() * 15))::int,
  (5 + floor(random() * 10))::int,
  (5 + floor(random() * 10))::int,
  (5 + floor(random() * 15))::int,
  round((3.5 + random() * 1.5)::numeric, 2),
  random() < 0.2
from target_profiles p
cross join days d;
