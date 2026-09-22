import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { endOfDay, type DateRange } from "@/lib/reports/definitions";

export interface ChartCategory {
  label: string;
  value: number;
}

export interface SeriesLineDef {
  key: string;
  label: string;
  color: string;
}

// Generic "page through one item at a time" shape, shared by campaign
// reports (one item per campaign) and the profile statistics report (one
// item per profile) — each item gets its own stat tiles, a category
// breakdown, and a day-by-day trend with report-specific series lines.
export interface PreviewItem {
  id: string;
  name: string;
  subtitle: string;
  stats: { label: string; value: string }[];
  breakdown: ChartCategory[];
  series: Record<string, number | string>[];
  seriesKeys: SeriesLineDef[];
}

export type ChartPreview =
  | { mode: "aggregate"; title: string; categories: ChartCategory[] }
  | { mode: "items"; title: string; items: PreviewItem[] };

const ITEM_MODE_REPORT_KEYS = new Set(["campaign_delivery", "campaign_statistics", "profile_statistics"]);

export function isItemModeReport(reportKey: string): boolean {
  return ITEM_MODE_REPORT_KEYS.has(reportKey);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

async function buildCampaignItems(supabase: SupabaseClient<Database>, range: DateRange): Promise<PreviewItem[]> {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .gte("created_at", range.from)
    .lte("created_at", endOfDay(range.to))
    .order("created_at", { ascending: false })
    .limit(25);

  const items: PreviewItem[] = [];
  for (const c of campaigns ?? []) {
    const { data: sends } = await supabase
      .from("campaign_sends")
      .select("status, sent_at, opened_at")
      .eq("campaign_id", c.id);

    const rows = sends ?? [];
    const sent = rows.filter((s) => ["sent", "opened", "clicked"].includes(s.status)).length;
    const opened = rows.filter((s) => ["opened", "clicked"].includes(s.status)).length;
    const clicked = rows.filter((s) => s.status === "clicked").length;
    const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

    // Real cumulative counts by day from actual sent_at/opened_at
    // timestamps — no synthetic distribution.
    const days = new Map<string, { sent: number; opened: number }>();
    for (const s of rows) {
      if (s.sent_at) {
        const k = dayKey(s.sent_at);
        days.set(k, { sent: (days.get(k)?.sent ?? 0) + 1, opened: days.get(k)?.opened ?? 0 });
      }
      if (s.opened_at) {
        const k = dayKey(s.opened_at);
        days.set(k, { sent: days.get(k)?.sent ?? 0, opened: (days.get(k)?.opened ?? 0) + 1 });
      }
    }
    const sortedDays = [...days.keys()].sort();
    let runningSent = 0;
    let runningOpened = 0;
    const series = sortedDays.map((d) => {
      const v = days.get(d)!;
      runningSent += v.sent;
      runningOpened += v.opened;
      return { date: d.slice(5), sent: runningSent, opened: runningOpened };
    });

    items.push({
      id: c.id,
      name: c.name,
      subtitle: `created ${new Date(c.created_at).toLocaleDateString()}`,
      stats: [
        { label: "Sent", value: String(sent) },
        { label: "Open rate", value: pct(opened, sent) },
        { label: "Click rate", value: pct(clicked, sent) },
      ],
      breakdown: [
        { label: "Sent", value: sent },
        { label: "Opened", value: opened },
        { label: "Clicked", value: clicked },
      ],
      series,
      seriesKeys: [
        { key: "sent", label: "Sent (cumulative)", color: "#4C5FDB" },
        { key: "opened", label: "Opened (cumulative)", color: "#16A34A" },
      ],
    });
  }
  return items;
}

async function buildProfileStatItems(supabase: SupabaseClient<Database>, range: DateRange): Promise<PreviewItem[]> {
  const { data: rows } = await supabase
    .from("profile_daily_stats")
    .select("*, profiles(name)")
    .gte("stat_date", range.from)
    .lte("stat_date", range.to)
    .order("stat_date", { ascending: true })
    .limit(5000);

  const byProfile = new Map<string, { name: string; rows: NonNullable<typeof rows> }>();
  for (const r of rows ?? []) {
    const profile = r.profiles as unknown as { name: string } | null;
    const key = r.profile_id;
    if (!byProfile.has(key)) byProfile.set(key, { name: profile?.name ?? "—", rows: [] });
    byProfile.get(key)!.rows.push(r);
  }

  const items: PreviewItem[] = [];
  for (const [profileId, { name, rows: profileRows }] of byProfile) {
    const latest = profileRows[profileRows.length - 1];
    const latestScore =
      latest.profile_completion_points +
      latest.review_reply_points +
      latest.connections_points +
      latest.listings_points +
      latest.web_analytics_points;

    const series = profileRows.map((r) => ({
      date: r.stat_date.slice(5),
      score:
        r.profile_completion_points + r.review_reply_points + r.connections_points + r.listings_points + r.web_analytics_points,
      views: r.profile_views,
    }));

    items.push({
      id: profileId,
      name,
      subtitle: `${profileRows.length} day${profileRows.length === 1 ? "" : "s"} tracked`,
      stats: [
        { label: "Search Rank Score", value: String(latestScore) },
        { label: "Location Rank", value: latest.location_rank != null ? `#${latest.location_rank}` : "—" },
        { label: "Top 5%", value: latest.top_5_percent ? "Yes" : "No" },
      ],
      breakdown: [
        { label: "Profile completion", value: latest.profile_completion_points },
        { label: "Review replies", value: latest.review_reply_points },
        { label: "Connections", value: latest.connections_points },
        { label: "Listings", value: latest.listings_points },
        { label: "Web analytics", value: latest.web_analytics_points },
      ],
      series,
      seriesKeys: [
        { key: "score", label: "Search Rank Score", color: "#4C5FDB" },
        { key: "views", label: "Profile views", color: "#F5821F" },
      ],
    });
  }
  return items;
}

export async function buildChartPreview(
  supabase: SupabaseClient<Database>,
  reportKey: string,
  range: DateRange
): Promise<ChartPreview> {
  if (reportKey === "campaign_delivery" || reportKey === "campaign_statistics") {
    return { mode: "items", title: "Campaign Delivery Report", items: await buildCampaignItems(supabase, range) };
  }

  if (reportKey === "profile_statistics") {
    return { mode: "items", title: "Profile Statistics Report", items: await buildProfileStatItems(supabase, range) };
  }

  if (reportKey === "survey_results" || reportKey === "srs_overview") {
    const { data } = await supabase
      .from("survey_responses")
      .select("rating")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to));
    const rows = data ?? [];
    const categories = [1, 2, 3, 4, 5].map((star) => ({
      label: `${star}★`,
      value: rows.filter((r) => r.rating === star).length,
    }));
    return { mode: "aggregate", title: "Rating distribution", categories };
  }

  // account_statistics (default)
  const { data: profiles } = await supabase
    .from("profiles")
    .select("status")
    .gte("created_at", range.from)
    .lte("created_at", endOfDay(range.to));
  const rows = profiles ?? [];
  const categories: ChartCategory[] = [
    { label: "Total", value: rows.length },
    { label: "Unclaimed", value: rows.filter((p) => p.status === "unclaimed").length },
    { label: "Claimed", value: rows.filter((p) => p.status === "claimed").length },
    { label: "Pro", value: rows.filter((p) => p.status === "pro").length },
  ];
  return { mode: "aggregate", title: "Account Statistics Report", categories };
}
