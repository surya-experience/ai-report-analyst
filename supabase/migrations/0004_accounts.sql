-- =========================================================================
-- Accounts: the real schema behind the Account Statistics Report, matching
-- the production system it's modeled on (see src/lib/reports/knowledge.ts).
-- This app has no organization/tier/campaign-publishing/social-connection
-- system of its own, so this table is a standalone snapshot dataset for
-- this one report — seeded with sample data (supabase/seed_accounts.sql),
-- not derived from `profiles`/`campaigns`.
-- =========================================================================

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  organization_name text not null,
  number_of_tiers int not null default 0,
  number_of_locations int not null default 0,
  number_of_users int not null default 0,
  number_of_verified_users int not null default 0,
  number_of_active_campaigns int not null default 0,
  number_of_surveys_sent int not null default 0,
  number_of_surveys_completed int not null default 0,
  number_of_inactive_campaigns int not null default 0,
  number_of_tiers_published_listings int not null default 0,
  number_of_users_published_listings int not null default 0,
  number_of_tiers_published_profile_pages int not null default 0,
  number_of_users_published_profile_pages int not null default 0,
  number_of_mismatches int not null default 0,
  completion_rate_pct numeric(6, 2), -- null represents "N/A" (completed > sent)
  tiers_facebook_connected int not null default 0,
  tiers_twitter_connected int not null default 0,
  tiers_linkedin_connected int not null default 0,
  agents_facebook_connected int not null default 0,
  agents_twitter_connected int not null default 0,
  agents_linkedin_connected int not null default 0,
  tiers_verified_gmb int not null default 0,
  tiers_missing_gmb int not null default 0,
  agents_verified_gmb int not null default 0,
  agents_missing_gmb int not null default 0,
  tiers_missing_photos int not null default 0,
  agents_missing_photos int not null default 0,
  tiers_missing_urls int not null default 0,
  agents_missing_urls int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
create policy "staff read accounts" on public.accounts
  for select using (public.is_admin_or_support());
