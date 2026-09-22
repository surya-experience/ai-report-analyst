import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { endOfDay, type DateRange } from "@/lib/reports/definitions";

export interface ChartCategory {
  label: string;
  value: number;
}

export interface CampaignPreviewItem {
  id: string;
  name: string;
  createdAt: string;
  stats: { label: string; value: string }[];
  breakdown: ChartCategory[];
  series: { date: string; sent: number; opened: number }[];
}

export type ChartPreview =
  | { mode: "aggregate"; title: string; categories: ChartCategory[] }
  | { mode: "items"; title: string; items: CampaignPreviewItem[] };

const CAMPAIGN_REPORT_KEYS = new Set(["campaign_delivery", "campaign_statistics"]);

export function isCampaignReport(reportKey: string): boolean {
  return CAMPAIGN_REPORT_KEYS.has(reportKey);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

async function buildCampaignItems(
  supabase: SupabaseClient<Database>,
  range: DateRange
): Promise<CampaignPreviewItem[]> {
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .gte("created_at", range.from)
    .lte("created_at", endOfDay(range.to))
    .order("created_at", { ascending: false })
    .limit(25);

  const items: CampaignPreviewItem[] = [];
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
      createdAt: c.created_at,
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
    });
  }
  return items;
}

export async function buildChartPreview(
  supabase: SupabaseClient<Database>,
  reportKey: string,
  range: DateRange
): Promise<ChartPreview> {
  if (isCampaignReport(reportKey)) {
    return { mode: "items", title: "Campaign Delivery Report", items: await buildCampaignItems(supabase, range) };
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
