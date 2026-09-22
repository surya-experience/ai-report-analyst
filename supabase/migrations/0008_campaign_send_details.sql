-- Adds the chart-worthy columns from the real Campaign Delivery Status
-- Report (a transaction-level, one-row-per-send report — see
-- src/lib/reports/knowledge.ts) that this app's simplified campaign_sends
-- table didn't have: which tier/agent handled the send, how the survey was
-- sent, whether it was anonymous, the recipient's user status, and reminder
-- counts. Nullable/defaulted so existing rows stay valid.
alter table public.campaign_sends
  add column if not exists tier_label text,
  add column if not exists agent_name text,
  add column if not exists survey_source text,
  add column if not exists anonymous_survey boolean not null default false,
  add column if not exists user_status text not null default 'Active',
  add column if not exists email_reminders_sent integer not null default 0,
  add column if not exists sms_sent integer not null default 0;
