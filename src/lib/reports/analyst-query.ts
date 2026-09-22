import "server-only";

// Executes the Report Analyst's `query_report_data` tool calls against
// already-fetched report rows — in-process grouping/filtering/aggregation,
// no extra DB round-trip per call. Keeps the tool's output small (grouped
// summaries, capped row counts, only the requested columns) so the model
// never has to be handed more than it asked for.
export interface QueryArgs {
  groupBy?: string;
  aggregate?: "count" | "sum" | "avg";
  aggregateField?: string;
  filters?: Record<string, string>;
  columns?: string[];
  limit?: number;
  sort?: "asc" | "desc";
}

export interface QueryResult {
  totalMatched: number;
  groups?: { label: string; value: number }[];
  rows?: Record<string, string | number>[];
}

export function queryRows(rows: Record<string, string | number>[], args: QueryArgs): QueryResult {
  let filtered = rows;
  if (args.filters) {
    for (const [key, value] of Object.entries(args.filters)) {
      filtered = filtered.filter((r) => String(r[key] ?? "") === String(value));
    }
  }
  const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

  if (args.groupBy) {
    const groups = new Map<string, number[]>();
    for (const r of filtered) {
      const key = String(r[args.groupBy] ?? "—");
      const bucket = groups.get(key) ?? [];
      bucket.push(
        args.aggregate === "sum" || args.aggregate === "avg" ? Number(r[args.aggregateField ?? ""]) || 0 : 1
      );
      groups.set(key, bucket);
    }
    const results = [...groups.entries()].map(([label, values]) => {
      let value: number;
      if (args.aggregate === "sum") value = values.reduce((a, b) => a + b, 0);
      else if (args.aggregate === "avg") value = values.length ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2)) : 0;
      else value = values.length;
      return { label, value };
    });
    results.sort((a, b) => (args.sort === "asc" ? a.value - b.value : b.value - a.value));
    return { totalMatched: filtered.length, groups: results.slice(0, limit) };
  }

  const cols = args.columns?.length ? args.columns : undefined;
  const projected = filtered.slice(0, limit).map((r) => {
    if (!cols) return r;
    const out: Record<string, string | number> = {};
    for (const c of cols) if (c in r) out[c] = r[c];
    return out;
  });
  return { totalMatched: filtered.length, rows: projected };
}
