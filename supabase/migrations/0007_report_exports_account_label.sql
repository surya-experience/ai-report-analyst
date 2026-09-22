-- Stores the human-readable account name (or null for "all accounts") at
-- export time, so the friendly download filename can be reconstructed
-- later from "Recent exports" without re-deriving it from accountId, which
-- isn't stored and may no longer resolve to the same account by then.
alter table public.report_exports
  add column if not exists account_label text;
