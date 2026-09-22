-- Sample accounts for the Account Statistics Report — see migration
-- 0004_accounts.sql for why this is a standalone seeded dataset rather
-- than derived from `profiles`. Safe to re-run (deletes by name first).
-- The first row is real sample data provided directly; the other five are
-- constructed to be plausible and to cover the documented edge cases
-- (completion_rate_pct = NULL for the completed>sent anomaly, an account
-- with zero active campaigns, etc.) so the report and analyst have
-- something real to reason about.

delete from public.accounts where account_name in (
  'Sandbox Pre Deployment Test', 'Harborline Realty Group', 'Northgate Wealth Partners',
  'Clearpath Lending Solutions', 'Chen Realty Enterprise', 'Blackwood Insurance Group'
);

insert into public.accounts (
  account_name, organization_name, number_of_tiers, number_of_locations, number_of_users, number_of_verified_users,
  number_of_active_campaigns, number_of_surveys_sent, number_of_surveys_completed, number_of_inactive_campaigns,
  number_of_tiers_published_listings, number_of_users_published_listings,
  number_of_tiers_published_profile_pages, number_of_users_published_profile_pages,
  number_of_mismatches, completion_rate_pct,
  tiers_facebook_connected, tiers_twitter_connected, tiers_linkedin_connected,
  agents_facebook_connected, agents_twitter_connected, agents_linkedin_connected,
  tiers_verified_gmb, tiers_missing_gmb, agents_verified_gmb, agents_missing_gmb,
  tiers_missing_photos, agents_missing_photos, tiers_missing_urls, agents_missing_urls
) values
  -- Real sample row, as provided.
  ('Sandbox Pre Deployment Test', 'Sandbox Pre Deployment QA Testing', 16, 11, 42, 17,
   60, 2388, 365, 38, 1, 7, 5, 11, 36, 15.28,
   0, 1, 0, 8, 6, 3, 0, 16, 2, 40, 8, 32, 5, 4),

  -- Larger, more mature account: high verification, most tiers published.
  ('Harborline Realty Group', 'Harborline Holdings', 24, 18, 96, 78,
   112, 5140, 2210, 9, 20, 61, 18, 55, 4, 43.00,
   14, 6, 11, 52, 21, 34, 19, 5, 61, 17, 3, 9, 2, 6),

  -- Small account, low activity, zero active campaigns.
  ('Northgate Wealth Partners', 'Northgate Financial Group', 3, 2, 8, 3,
   0, 40, 6, 1, 0, 0, 1, 2, 1, 15.00,
   0, 0, 0, 1, 0, 2, 0, 3, 0, 8, 2, 5, 1, 3),

  -- Data anomaly: completed exceeds sent -> completion_rate_pct is NULL ("N/A" per docs).
  ('Clearpath Lending Solutions', 'Clearpath Mortgage Network', 9, 6, 27, 20,
   30, 150, 210, 4, 4, 12, 6, 15, 11, null,
   3, 2, 5, 12, 8, 10, 6, 3, 15, 5, 1, 4, 0, 2),

  -- Mid-size, strong GMB/social presence.
  ('Chen Realty Enterprise', 'Chen Realty Partners', 12, 9, 34, 29,
   45, 980, 512, 6, 10, 22, 9, 20, 2, 52.24,
   9, 7, 8, 24, 15, 19, 11, 1, 26, 3, 1, 2, 0, 1),

  -- Larger account with weaker digital presence (many missing photos/URLs).
  ('Blackwood Insurance Group', 'Blackwood & Co Holdings', 18, 14, 61, 22,
   28, 1875, 190, 22, 2, 9, 3, 8, 19, 10.13,
   1, 0, 2, 6, 4, 3, 1, 17, 4, 57, 11, 39, 9, 14);
