-- =========================================================================
-- Profile Statistics Report: day-by-day ranking/visibility metrics per
-- profile. This app has no real search-ranking pipeline (unlike the
-- production system this report type is modeled on — see
-- src/lib/reports/knowledge.ts), so this table holds seeded sample data,
-- same pattern as surveys in 0002_reports.sql.
-- =========================================================================

create table public.profile_daily_stats (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  stat_date date not null,
  location_rank int,
  profile_views int not null default 0,
  profile_completion_points int not null default 0,
  review_reply_points int not null default 0,
  connections_points int not null default 0,
  listings_points int not null default 0,
  web_analytics_points int not null default 0,
  total_experience_score numeric(3, 2),
  top_5_percent boolean not null default false,
  created_at timestamptz not null default now(),
  unique (profile_id, stat_date)
);
create index profile_daily_stats_profile_idx on public.profile_daily_stats(profile_id, stat_date);

alter table public.profile_daily_stats enable row level security;
create policy "staff read profile daily stats" on public.profile_daily_stats
  for select using (public.is_admin_or_support());
