-- PDF export was dropped — only XLSX and CSV are offered now. Tighten the
-- constraint to match (no existing rows use 'pdf', so this is safe).
alter table public.report_exports
  drop constraint report_exports_format_check;

alter table public.report_exports
  add constraint report_exports_format_check check (format in ('xlsx', 'csv'));
