-- Links each survey to the campaign that requested it, so Survey Results
-- can be filtered by campaign the same way Campaign Delivery Status is
-- filtered by campaign_id on campaign_sends. Nullable + on delete set null:
-- a survey isn't required to have originated from a tracked campaign.
alter table public.surveys
  add column if not exists campaign_id uuid references public.campaigns(id) on delete set null;

-- Backfill the two seeded surveys (from supabase/seed_reports.sql) to point
-- at two of the seeded campaigns (from supabase/seed_campaigns.sql), purely
-- so the new campaign filter has something to show for the sample data.
-- Safe to re-run.
update public.surveys
set campaign_id = (select id from public.campaigns where name = 'Upgrade to Pro' limit 1)
where name = 'Client Satisfaction Survey';

update public.surveys
set campaign_id = (select id from public.campaigns where name = 'Welcome Back' limit 1)
where name = 'Onboarding Experience Survey';
