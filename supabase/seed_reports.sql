-- Sample survey data for the Survey Results / SRS Overview reports — this
-- app has no survey-taking feature elsewhere, so these rows are seeded
-- directly rather than produced by a real flow (see README "Reports").
--
-- random()/floor() calls live in the outer SELECT list (not inside a
-- LATERAL subquery that doesn't reference the row it's joined against) so
-- Postgres actually re-evaluates them per row — an uncorrelated LATERAL
-- subquery is evaluated once and its single result gets reused for every
-- row, which is the bug this form avoids.
insert into public.surveys (id, name, created_at) values
  ('a1a1a1a1-0001-4000-8000-000000000001', 'Client Satisfaction Survey', now() - interval '60 days'),
  ('a1a1a1a1-0001-4000-8000-000000000002', 'Onboarding Experience Survey', now() - interval '30 days')
on conflict (id) do nothing;

-- Safe to re-run: clears any previously seeded responses first (in case
-- you ran an earlier version of this script) before inserting fresh ones.
delete from public.survey_responses
where survey_id in (select id from public.surveys where name in ('Client Satisfaction Survey', 'Onboarding Experience Survey'));

-- Each response is a client's review of one agent's profile — profile_id
-- is picked from the same "active" agent set seed_profile_stats.sql uses,
-- weighted so Taylor Alison gets roughly a third of responses (per
-- product's request for more sample data on that profile specifically)
-- and the remaining agents split the rest.
with client_names as (
  select unnest(array[
    'Dana W.','Marcus R.','Priya S.','Owen B.','Taylor A.',
    'Grace L.','Tomás H.','Wei C.','Aaliyah J.','Nils P.',
    'Jordan K.','Sam T.'
  ]) as name
)
insert into public.survey_responses (survey_id, profile_id, respondent_name, rating, comments, created_at)
select
  (select id from public.surveys where name = 'Client Satisfaction Survey'),
  (select id from public.profiles where name = (array[
    'Taylor Alison','Taylor Alison','Wei Chen','Priya Subramaniam','Grace Lindqvist','Marcus Reyes'
  ])[1 + floor(random() * 6)] limit 1),
  name,
  (1 + floor(random() * 5))::int,
  (array[
    'Great experience overall.',
    'Support was fast and helpful.',
    'Would like more profile customization options.',
    'Claiming my profile was quick and easy.',
    'The AI coach made setup painless.',
    null,
    null
  ])[1 + floor(random() * 7)],
  now() - (floor(random() * 55) || ' days')::interval
from client_names;

with onboarding_names as (
  select unnest(array['Dana W.','Marcus R.','Priya S.','Taylor A.','Grace L.','Wei C.','Aaliyah J.']) as name
)
insert into public.survey_responses (survey_id, profile_id, respondent_name, rating, comments, created_at)
select
  (select id from public.surveys where name = 'Onboarding Experience Survey'),
  (select id from public.profiles where name = (array[
    'Taylor Alison','Taylor Alison','Wei Chen','Priya Subramaniam','Grace Lindqvist','Marcus Reyes'
  ])[1 + floor(random() * 6)] limit 1),
  name,
  (2 + floor(random() * 4))::int,
  (array[
    'Onboarding steps were clear.',
    'Took longer than expected to verify my email.',
    'Liked the AI Coach walking me through fields.',
    null,
    null
  ])[1 + floor(random() * 5)],
  now() - (floor(random() * 28) || ' days')::interval
from onboarding_names;

-- Extra responses specifically for Taylor Alison, across both surveys and
-- a wider set of respondent names, so the Agent/Campaign breakdown charts
-- and the SRS-style "which agent" analyst questions have a clearly
-- standout profile to point to instead of a near-even split.
with taylor_names as (
  select unnest(array[
    'Ivy R.','Noah F.','Camila D.','Ethan V.','Lucia M.',
    'Ravi K.','Bianca S.','Theo N.','Mei L.','Diego A.'
  ]) as name
)
insert into public.survey_responses (survey_id, profile_id, respondent_name, rating, comments, created_at)
select
  (array[
    (select id from public.surveys where name = 'Client Satisfaction Survey'),
    (select id from public.surveys where name = 'Onboarding Experience Survey')
  ])[1 + floor(random() * 2)],
  (select id from public.profiles where name = 'Taylor Alison'),
  name,
  (3 + floor(random() * 3))::int,
  (array[
    'Taylor was incredibly responsive throughout.',
    'Closed on our Miami condo faster than expected.',
    'Really knows the waterfront market.',
    null,
    null
  ])[1 + floor(random() * 5)],
  now() - (floor(random() * 40) || ' days')::interval
from taylor_names;
