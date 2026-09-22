-- Sample profiles for local development, mirroring the original prototype's
-- seed set so the UI has realistic data to render against.
insert into public.profiles (name, profession, org, location, email, phone, status, fields, created_at, claimed_at)
values
  ('Dana Whitfield', 'Real Estate Agent', 'Harborline Realty', 'Austin, TX', 'dana.whitfield@example.com', '5124589021', 'unclaimed',
   '{"headline":"Helping Austin buyers find home","photo":true}', '2025-11-02T10:00:00Z', null),
  ('Marcus Reyes', 'Financial Advisor', 'Northgate Wealth', 'Denver, CO', 'marcus.reyes@example.com', '3035557788', 'claimed',
   '{"headline":"Fee-only planning for growing families","summary":"12 years helping families plan for retirement and college.","photo":true,"skills":["Retirement planning","Tax strategy"],"services":["1:1 planning"]}',
   '2025-09-14T10:00:00Z', '2025-09-20T10:00:00Z'),
  ('Priya Subramaniam', 'Mortgage Broker', 'Clearpath Lending', 'Seattle, WA', 'priya.s@example.com', '2065559981', 'pro',
   '{"headline":"Fast, transparent home loans","summary":"I close loans in under 21 days on average.","photo":true,"skills":["FHA loans","Refinancing"],"services":["Pre-approval","Refinance review"],"licence":["NMLS Licensed"],"yearStarted":"2016"}',
   '2025-06-01T10:00:00Z', '2025-06-10T10:00:00Z'),
  ('Owen Blackwood', 'Insurance Agent', 'Blackwood & Co', 'Tampa, FL', 'owen.b@example.com', '8135557712', 'unclaimed', '{}', '2025-08-19T10:00:00Z', null),
  ('Taylor Alison', 'Real Estate Agent', 'Alison Realty Group', 'Miami, FL', 'taylor.alison@example.com', '3055559090', 'claimed',
   '{"headline":"Miami luxury condos & waterfront homes"}', '2026-09-01T10:00:00Z', '2026-09-01T10:00:00Z'),
  ('Grace Lindqvist', 'Financial Advisor', 'Lindqvist Capital', 'Minneapolis, MN', 'grace.l@example.com', '6125558822', 'claimed',
   '{"headline":"Independent fiduciary advisor","summary":"Working with pre-retirees on income planning.","photo":true,"skills":["Income planning"],"yearStarted":"2011"}',
   '2025-07-22T10:00:00Z', '2025-07-30T10:00:00Z'),
  ('Tomás Herrera', 'Mortgage Broker', 'Herrera Home Loans', 'Phoenix, AZ', 'tomas.h@example.com', '6025557766', 'unclaimed', '{}', '2025-10-05T10:00:00Z', null),
  ('Wei Chen', 'Real Estate Agent', 'Chen Realty Partners', 'San Jose, CA', 'wei.chen@example.com', '4085551123', 'pro',
   '{"headline":"South Bay tech-relocation specialist","summary":"Helping relocating tech employees buy their first home in the Bay Area.","photo":true,"skills":["Relocation","First-time buyers"],"services":["Buyer consults"],"licence":["CRS"],"yearStarted":"2016"}',
   '2025-05-11T10:00:00Z', '2025-05-18T10:00:00Z'),
  ('Aaliyah Johnson', 'Insurance Agent', 'Johnson Family Insurance', 'Atlanta, GA', 'aaliyah.j@example.com', '4045558800', 'claimed',
   '{"headline":"Home & auto bundles for Atlanta families"}', '2026-08-28T10:00:00Z', '2026-08-28T10:00:00Z'),
  ('Nils Petersen', 'Financial Advisor', 'Petersen Advisory', 'Chicago, IL', 'nils.p@example.com', '3125557744', 'unclaimed', '{}', '2025-12-01T10:00:00Z', null);

-- subscriptions for the two 'pro' profiles
insert into public.subscriptions (profile_id, plan, status, current_period_end)
select id, 'pro', 'active', now() + interval '30 days' from public.profiles where status = 'pro';

-- a spread of historical conversion events so funnel charts aren't empty
insert into public.conversion_events (type, ts)
select
  (array['claim_started','claim_completed','upgrade_page_viewed','subscription_activated'])[floor(random()*4+1)],
  now() - (floor(random()*14) || ' days')::interval - (floor(random()*24) || ' hours')::interval
from generate_series(1, 80);
