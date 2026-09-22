-- Backfills the columns added in migration 0008_campaign_send_details.sql
-- (tier/agent/source/anonymous/user-status/reminders) onto every existing
-- campaign_sends row, using the real Campaign Delivery Status Report's
-- observed value sets (Tier Label, Survey Source, User Status) as a guide
-- — see src/lib/reports/knowledge.ts. Safe to re-run: each run reassigns
-- fresh random values to every row.
--
-- random()/floor() calls live in this CTE's plain SELECT list, not inside
-- a LATERAL subquery, so each row gets its own independent value — see
-- supabase/seed_reports.sql for why an uncorrelated LATERAL subquery would
-- instead evaluate once and reuse the same value across every row.
with picks as (
  select
    id,
    (array['Region Tier', 'HQ Tier', 'Branch Tier'])[1 + floor(random() * 3)::int] as tier_label,
    (array['Lavanya Darel', 'Utsav Joshi', 'Sahaj Saluja', 'Priya Menon', 'Grace Lindqvist'])[1 + floor(random() * 5)::int] as agent_name,
    (array['write_review', 'ManualUpload', 'QrCode', 'API', 'SFTP', 'FollowUp'])[1 + floor(random() * 6)::int] as survey_source,
    random() < 0.05 as anonymous_survey,
    case when random() < 0.85 then 'Active' else 'Onboarding' end as user_status,
    floor(random() * 4)::int as email_reminders_sent,
    floor(random() * 3)::int as sms_sent
  from public.campaign_sends
)
update public.campaign_sends cs
set
  tier_label = picks.tier_label,
  agent_name = picks.agent_name,
  survey_source = picks.survey_source,
  anonymous_survey = picks.anonymous_survey,
  user_status = picks.user_status,
  email_reminders_sent = picks.email_reminders_sent,
  sms_sent = picks.sms_sent
from picks
where cs.id = picks.id;
