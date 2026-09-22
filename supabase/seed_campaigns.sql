-- Sample campaigns + sends for the Campaign Delivery Status / Campaign
-- Statistics reports, so there's more than one campaign to page through in
-- the report preview. Safe to re-run (deletes previously seeded campaigns
-- by name first, which cascades to their sends).
--
-- Split into plain sequential statements (rather than one WITH-based
-- data-modifying CTE chain) so each step is easy to run and debug on its
-- own in the SQL Editor. random()/floor() calls live in a plain SELECT's
-- column list, not inside a LATERAL subquery — see supabase/seed_reports.sql
-- for why that distinction matters (an uncorrelated LATERAL subquery is
-- evaluated once and its result reused across every row it's joined
-- against).

delete from public.campaigns where name in (
  'Unclaimed Profile Reminder', 'Finish Your Profile', 'Upgrade to Pro',
  'Welcome Back', 'Almost There — Claim Now', 'Spring Refresh Campaign'
);

insert into public.campaigns (name, segment, subject, body, html_body, status, created_at, sent_at)
values
  ('Unclaimed Profile Reminder', 'unclaimed', 'Your profile is ready to claim', 'A profile matching your name is live on Experience.com.', '<p>A profile matching your name is live on Experience.com.</p>', 'sent', now() - interval '58 days', now() - interval '58 days'),
  ('Finish Your Profile', 'incomplete', 'A few details left on your profile', 'You are almost done setting up your profile.', '<p>You are almost done setting up your profile.</p>', 'sent', now() - interval '45 days', now() - interval '45 days'),
  ('Upgrade to Pro', 'pro_eligible', 'Get noticed more with Pro', 'Your profile qualifies for a verified badge and boosted ranking.', '<p>Your profile qualifies for a verified badge and boosted ranking.</p>', 'sent', now() - interval '33 days', now() - interval '33 days'),
  ('Welcome Back', 're_engagement', 'We miss you', 'Your profile is still live and getting views.', '<p>Your profile is still live and getting views.</p>', 'sent', now() - interval '20 days', now() - interval '20 days'),
  ('Almost There — Claim Now', 'claim_reminder', 'One step from live', 'Your profile is mostly filled in already — claim it to finish.', '<p>Your profile is mostly filled in already — claim it to finish.</p>', 'sent', now() - interval '9 days', now() - interval '9 days'),
  ('Spring Refresh Campaign', 'incomplete', 'Give your profile a refresh', 'Update your profile details for the new season.', '<p>Update your profile details for the new season.</p>', 'sent', now() - interval '2 days', now() - interval '2 days');

-- One row per (new campaign x profile-with-email), with a per-row random
-- "roll" that decides the outcome (failed / sent-only / opened / clicked)
-- and a randomized send time within a few days of the campaign's creation.
-- roll/send_time are computed once per row in this subquery's column list
-- (a plain SELECT, not a LATERAL subquery), then reused consistently
-- across the CASE branches below via the outer query's column references.
insert into public.campaign_sends (campaign_id, profile_id, status, sent_at, opened_at, clicked_at, created_at)
select
  rolled.campaign_id,
  rolled.profile_id,
  case
    when rolled.roll < 0.10 then 'failed'
    when rolled.roll < 0.25 then 'sent'
    when rolled.roll < 0.60 then 'opened'
    else 'clicked'
  end,
  case when rolled.roll < 0.10 then null else rolled.send_time end,
  case when rolled.roll >= 0.25 then rolled.send_time + (floor(random() * 6) || ' hours')::interval else null end,
  case when rolled.roll >= 0.60 then rolled.send_time + (floor(random() * 6) || ' hours')::interval + (floor(random() * 3) || ' hours')::interval else null end,
  rolled.send_time
from (
  select
    c.id as campaign_id,
    p.id as profile_id,
    random() as roll,
    c.created_at + (floor(random() * 3) || ' days')::interval + (floor(random() * 12) || ' hours')::interval as send_time
  from public.campaigns c
  cross join public.profiles p
  where p.email is not null
    and c.name in (
      'Unclaimed Profile Reminder', 'Finish Your Profile', 'Upgrade to Pro',
      'Welcome Back', 'Almost There — Claim Now', 'Spring Refresh Campaign'
    )
) as rolled;
