import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { completenessOf } from "@/lib/profile-fields";

export interface ReportData {
  statusCounts: { status: string; count: number }[];
  completenessBuckets: { bucket: string; count: number }[];
  signupsByWeek: { week: string; count: number }[];
  claimsByWeek: { week: string; count: number }[];
  topProfessions: { profession: string; count: number }[];
  campaignPerformance: { name: string; segment: string; sent: number; opened: number; clicked: number }[];
  totals: { profiles: number; unclaimed: number; claimed: number; pro: number; openSupportTickets: number };
}

function weekLabel(iso: string) {
  const d = new Date(iso);
  const day = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

// Single source of truth for every number the Reports page and the Report
// Analyst use — the analyst is only trustworthy if it reasons over exactly
// what's on screen, so both read from this function.
export async function buildReportData(supabase: SupabaseClient<Database>): Promise<ReportData> {
  const [{ data: profiles }, { data: events }, { data: campaigns }, { count: openTickets }] = await Promise.all([
    supabase.from("profiles").select("*"),
    supabase.from("conversion_events").select("type, ts").order("ts", { ascending: false }).limit(5000),
    supabase.from("campaigns").select("id, name, segment, status"),
    supabase
      .from("support_conversations")
      .select("*", { count: "exact", head: true })
      .in("status", ["open", "pending"]),
  ]);

  const rows = profiles ?? [];

  const statusCounts = ["unclaimed", "claimed", "pro"].map((status) => ({
    status,
    count: rows.filter((p) => p.status === status).length,
  }));

  const bucketDefs = [
    { bucket: "0-25%", min: 0, max: 25 },
    { bucket: "25-50%", min: 25, max: 50 },
    { bucket: "50-75%", min: 50, max: 75 },
    { bucket: "75-100%", min: 75, max: 101 },
  ];
  const completenessBuckets = bucketDefs.map((b) => ({
    bucket: b.bucket,
    count: rows.filter((p) => {
      const c = completenessOf(p);
      return c >= b.min && c < b.max;
    }).length,
  }));

  const signupWeeks = new Map<string, number>();
  for (const p of rows) {
    const w = weekLabel(p.created_at);
    signupWeeks.set(w, (signupWeeks.get(w) ?? 0) + 1);
  }
  const signupsByWeek = [...signupWeeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, count]) => ({ week, count }));

  const claimWeeks = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.type !== "claim_completed") continue;
    const w = weekLabel(e.ts);
    claimWeeks.set(w, (claimWeeks.get(w) ?? 0) + 1);
  }
  const claimsByWeek = [...claimWeeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, count]) => ({ week, count }));

  const professionCounts = new Map<string, number>();
  for (const p of rows) {
    professionCounts.set(p.profession, (professionCounts.get(p.profession) ?? 0) + 1);
  }
  const topProfessions = [...professionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([profession, count]) => ({ profession, count }));

  const campaignIds = (campaigns ?? []).map((c) => c.id);
  const { data: sends } = campaignIds.length
    ? await supabase.from("campaign_sends").select("campaign_id, status").in("campaign_id", campaignIds)
    : { data: [] as { campaign_id: string; status: string }[] };

  const campaignPerformance = (campaigns ?? []).map((c) => {
    const rows = (sends ?? []).filter((s) => s.campaign_id === c.id);
    return {
      name: c.name,
      segment: c.segment,
      sent: rows.filter((r) => ["sent", "opened", "clicked"].includes(r.status)).length,
      opened: rows.filter((r) => ["opened", "clicked"].includes(r.status)).length,
      clicked: rows.filter((r) => r.status === "clicked").length,
    };
  });

  return {
    statusCounts,
    completenessBuckets,
    signupsByWeek,
    claimsByWeek,
    topProfessions,
    campaignPerformance,
    totals: {
      profiles: rows.length,
      unclaimed: statusCounts.find((s) => s.status === "unclaimed")?.count ?? 0,
      claimed: statusCounts.find((s) => s.status === "claimed")?.count ?? 0,
      pro: statusCounts.find((s) => s.status === "pro")?.count ?? 0,
      openSupportTickets: openTickets ?? 0,
    },
  };
}
