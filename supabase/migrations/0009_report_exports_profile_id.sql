-- Scopes an export to the profile it was requested for, so the view-as
-- Reports page's "Recent exports" can show that member's own download
-- history on reload instead of always starting empty (it previously had
-- no way to look any up — the page passed an empty list on every render).
alter table public.report_exports
  add column if not exists profile_id uuid references public.profiles(id) on delete set null;

create index if not exists report_exports_profile_idx on public.report_exports(profile_id);
