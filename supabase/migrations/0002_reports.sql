-- =========================================================================
-- Reports: surveys (a domain the rest of the app doesn't otherwise model,
-- so these two report types run on real-but-seeded rows), plus a record of
-- every report export so "Recent exports" reflects real history.
-- =========================================================================

-- ---------------------------------------------------------------------
-- Surveys
-- ---------------------------------------------------------------------
create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  respondent_name text not null,
  rating int not null check (rating between 1 and 5),
  comments text,
  created_at timestamptz not null default now()
);
create index survey_responses_survey_idx on public.survey_responses(survey_id);

alter table public.surveys enable row level security;
alter table public.survey_responses enable row level security;

create policy "staff read surveys" on public.surveys
  for select using (public.is_admin_or_support());
create policy "staff read survey responses" on public.survey_responses
  for select using (public.is_admin_or_support());

-- ---------------------------------------------------------------------
-- Report exports (drives the "Recent exports" panel)
-- ---------------------------------------------------------------------
create table public.report_exports (
  id uuid primary key default gen_random_uuid(),
  report_key text not null,
  report_label text not null,
  format text not null check (format in ('xlsx', 'csv', 'pdf')),
  range_start date,
  range_end date,
  row_count int not null default 0,
  file_size_bytes int not null default 0,
  storage_path text not null,
  requested_by uuid references auth.users(id),
  requested_by_label text not null default 'Admin',
  created_at timestamptz not null default now()
);

alter table public.report_exports enable row level security;
create policy "staff read report exports" on public.report_exports
  for select using (public.is_admin_or_support());
create policy "staff insert report exports" on public.report_exports
  for insert with check (public.is_admin_or_support());

-- Private bucket for generated report files; the app hands out short-lived
-- signed URLs rather than serving these publicly.
insert into storage.buckets (id, name, public)
values ('report-exports', 'report-exports', false)
on conflict (id) do nothing;

create policy "staff read report export files" on storage.objects
  for select using (bucket_id = 'report-exports' and public.is_admin_or_support());
create policy "staff write report export files" on storage.objects
  for insert with check (bucket_id = 'report-exports' and public.is_admin_or_support());

alter publication supabase_realtime add table public.report_exports;
