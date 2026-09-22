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

with client_names as (
  select unnest(array[
    'Dana W.','Marcus R.','Priya S.','Owen B.','Taylor A.',
    'Grace L.','Tomás H.','Wei C.','Aaliyah J.','Nils P.',
    'Jordan K.','Sam T.'
  ]) as name
)
insert into public.survey_responses (survey_id, respondent_name, rating, comments, created_at)
select
  (select id from public.surveys where name = 'Client Satisfaction Survey'),
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
insert into public.survey_responses (survey_id, respondent_name, rating, comments, created_at)
select
  (select id from public.surveys where name = 'Onboarding Experience Survey'),
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
