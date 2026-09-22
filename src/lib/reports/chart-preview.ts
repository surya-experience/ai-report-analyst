import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Account } from "@/types/database";
import { endOfDay, type DateRange, type ReportParams } from "@/lib/reports/definitions";

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
  // Campaign items only: additional part-to-whole breakdowns beyond the
  // primary Sent/Opened/Clicked one (survey source, tier, user status,
  // anonymity) — rendered as a grid, same pattern as AccountBreakdown's
  // `groups`. Optional so profile_statistics items (a single breakdown,
  // no extra dimensions) are unaffected.
  groups?: ChartBreakdownGroup[];
  series: Record<string, number | string>[];
  seriesKeys: SeriesLineDef[];
}

export interface ChartBreakdownGroup {
  label: string;
  categories: ChartCategory[];
}

export interface AccountBreakdown {
  id: string;
  name: string;
  subtitle: string;
  groups: ChartBreakdownGroup[];
}

export interface AgentMetricDef {
  key: string;
  label: string;
}

export interface AgentSummary {
  id: string;
  name: string;
  metrics: Record<string, number>;
  // Search Rank Score's 5 category components for this one agent — only
  // meaningful scoped to a single agent (they sum to that agent's Search
  // Rank Score), not aggregated across agents.
  breakdown: ChartCategory[];
}

export type ChartPreview =
  | { mode: "aggregate"; title: string; categories: ChartCategory[] }
  | { mode: "items"; title: string; items: PreviewItem[] }
  // Account Statistics only: one entry per account in scope (just the
  // selected one, or all of them when the filter is "All accounts") —
  // pageable with the same prev/next pattern as `items`, so "all accounts"
  // is browsable instead of silently picking one.
  | { mode: "breakdowns"; title: string; accounts: AccountBreakdown[] }
  // SRS Overview only: one row per agent, so — unlike `items` — every
  // agent is visible at once for cross-agent bar comparisons, plus a
  // Top 5% split and each agent's own score breakdown for donut/pie.
  | { mode: "agents"; title: string; metrics: AgentMetricDef[]; agents: AgentSummary[]; top5: ChartCategory[] };

const ITEM_MODE_REPORT_KEYS = new Set(["campaign_delivery", "campaign_statistics", "profile_statistics"]);

export function isItemModeReport(reportKey: string): boolean {
  return ITEM_MODE_REPORT_KEYS.has(reportKey);
}

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

async function buildCampaignItems(
  supabase: SupabaseClient<Database>,
  range: DateRange,
  campaignId?: string
): Promise<PreviewItem[]> {
  let campaignQuery = supabase
    .from("campaigns")
    .select("*")
    .gte("created_at", range.from)
    .lte("created_at", endOfDay(range.to))
    .order("created_at", { ascending: false })
    .limit(25);
  if (campaignId) campaignQuery = campaignQuery.eq("id", campaignId);
  const { data: campaigns } = await campaignQuery;

  const items: PreviewItem[] = [];
  for (const c of campaigns ?? []) {
    const { data: sends } = await supabase
      .from("campaign_sends")
      .select("status, sent_at, opened_at, tier_label, survey_source, anonymous_survey, user_status")
      .eq("campaign_id", c.id);

    const rows = sends ?? [];
    const sent = rows.filter((s) => ["sent", "opened", "clicked"].includes(s.status)).length;
    const opened = rows.filter((s) => ["opened", "clicked"].includes(s.status)).length;
    const clicked = rows.filter((s) => s.status === "clicked").length;
    const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");

    // Extra breakdown groups from the real Campaign Delivery Status
    // Report's transaction-level columns (see knowledge.ts) — counted the
    // same way accountBreakdownGroups() counts a documented pair of
    // columns, just grouped by distinct value here since these are
    // free-form/categorical rather than fixed pairs.
    const countBy = (values: (string | null)[]) => {
      const counts = new Map<string, number>();
      for (const v of values) {
        const label = v ?? "—";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      return [...counts.entries()].map(([label, value]) => ({ label, value }));
    };
    const extraGroups: ChartBreakdownGroup[] =
      rows.length === 0
        ? []
        : [
            { label: "Survey source", categories: countBy(rows.map((s) => s.survey_source)) },
            { label: "Tier", categories: countBy(rows.map((s) => s.tier_label)) },
            { label: "User status", categories: countBy(rows.map((s) => s.user_status)) },
            {
              label: "Anonymous survey",
              categories: countBy(rows.map((s) => (s.anonymous_survey ? "Yes" : "No"))),
            },
          ];

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
      groups: [{ label: "Delivery status", categories: [
        { label: "Sent", value: sent },
        { label: "Opened", value: opened },
        { label: "Clicked", value: clicked },
      ] }, ...extraGroups],
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

const AGENT_METRICS: AgentMetricDef[] = [
  { key: "location_rank", label: "Location based Rank" },
  { key: "profile_views", label: "Total Visited Count" },
  { key: "search_rank_score", label: "Search Rank Score" },
  { key: "review_reply_points", label: "Reviews Replies Score" },
  { key: "profile_completion_points", label: "Profile Completion Score" },
  { key: "connections_points", label: "Social Connections Score" },
  { key: "web_analytics_points", label: "Web Analytics Score" },
  { key: "listings_points", label: "Listings Score" },
  { key: "total_experience_score", label: "Total Experience Score" },
];

// SRS = Search Rank Score. One row per agent, using each agent's LATEST
// snapshot at or before `range.to` — the real report is a point-in-time
// leaderboard, not a trend (that's what Profile Statistics is for, over
// the same underlying profile_daily_stats table).
async function buildAgentOverview(supabase: SupabaseClient<Database>, range: DateRange) {
  const { data } = await supabase
    .from("profile_daily_stats")
    .select("*, profiles(name)")
    .lte("stat_date", range.to)
    .order("stat_date", { ascending: false })
    .limit(5000);

  const latestByProfile = new Map<string, NonNullable<typeof data>[number]>();
  for (const r of data ?? []) {
    if (!latestByProfile.has(r.profile_id)) latestByProfile.set(r.profile_id, r);
  }

  const agents: AgentSummary[] = [...latestByProfile.values()].map((r) => {
    const profile = r.profiles as unknown as { name: string } | null;
    const searchRankScore =
      r.profile_completion_points + r.review_reply_points + r.connections_points + r.listings_points + r.web_analytics_points;
    return {
      id: r.profile_id,
      name: profile?.name ?? "—",
      metrics: {
        location_rank: r.location_rank ?? 0,
        profile_views: r.profile_views,
        search_rank_score: searchRankScore,
        review_reply_points: r.review_reply_points,
        profile_completion_points: r.profile_completion_points,
        connections_points: r.connections_points,
        web_analytics_points: r.web_analytics_points,
        listings_points: r.listings_points,
        total_experience_score: r.total_experience_score ?? 0,
      },
      breakdown: [
        { label: "Reviews Replies", value: r.review_reply_points },
        { label: "Profile Completion", value: r.profile_completion_points },
        { label: "Social Connections", value: r.connections_points },
        { label: "Web Analytics", value: r.web_analytics_points },
        { label: "Listings", value: r.listings_points },
      ],
    };
  });

  const top5 = [
    { label: "Top 5%", value: [...latestByProfile.values()].filter((r) => r.top_5_percent).length },
    { label: "Not top 5%", value: [...latestByProfile.values()].filter((r) => !r.top_5_percent).length },
  ];

  return { agents, top5 };
}

// Every pair here is a real part-to-whole breakdown of two-or-more columns
// on one `accounts` row — nothing here is estimated or invented, it's just
// the same numbers the export/table view shows, grouped for charting.
function accountBreakdownGroups(a: Account): ChartBreakdownGroup[] {
  return [
    {
      label: "Campaigns",
      categories: [
        { label: "Active", value: a.number_of_active_campaigns },
        { label: "Inactive", value: a.number_of_inactive_campaigns },
      ],
    },
    {
      label: "Surveys",
      categories: [
        { label: "Completed", value: a.number_of_surveys_completed },
        { label: "Not completed", value: Math.max(0, a.number_of_surveys_sent - a.number_of_surveys_completed) },
      ],
    },
    {
      label: "Users",
      categories: [
        { label: "Verified", value: a.number_of_verified_users },
        { label: "Unverified", value: Math.max(0, a.number_of_users - a.number_of_verified_users) },
      ],
    },
    {
      label: "Tiers — GMB",
      categories: [
        { label: "Verified", value: a.tiers_verified_gmb },
        { label: "Missing", value: a.tiers_missing_gmb },
      ],
    },
    {
      label: "Agents — GMB",
      categories: [
        { label: "Verified", value: a.agents_verified_gmb },
        { label: "Missing", value: a.agents_missing_gmb },
      ],
    },
    {
      label: "Tiers published — listings",
      categories: [
        { label: "Published", value: a.number_of_tiers_published_listings },
        { label: "Not published", value: Math.max(0, a.number_of_tiers - a.number_of_tiers_published_listings) },
      ],
    },
    {
      label: "Users published — listings",
      categories: [
        { label: "Published", value: a.number_of_users_published_listings },
        { label: "Not published", value: Math.max(0, a.number_of_users - a.number_of_users_published_listings) },
      ],
    },
    {
      label: "Tiers published — profile pages",
      categories: [
        { label: "Published", value: a.number_of_tiers_published_profile_pages },
        { label: "Not published", value: Math.max(0, a.number_of_tiers - a.number_of_tiers_published_profile_pages) },
      ],
    },
    {
      label: "Users published — profile pages",
      categories: [
        { label: "Published", value: a.number_of_users_published_profile_pages },
        { label: "Not published", value: Math.max(0, a.number_of_users - a.number_of_users_published_profile_pages) },
      ],
    },
    {
      label: "Tiers — social connections",
      categories: [
        { label: "Facebook", value: a.tiers_facebook_connected },
        { label: "Twitter", value: a.tiers_twitter_connected },
        { label: "LinkedIn", value: a.tiers_linkedin_connected },
      ],
    },
    {
      label: "Agents — social connections",
      categories: [
        { label: "Facebook", value: a.agents_facebook_connected },
        { label: "Twitter", value: a.agents_twitter_connected },
        { label: "LinkedIn", value: a.agents_linkedin_connected },
      ],
    },
  ];
}

export async function buildChartPreview(
  supabase: SupabaseClient<Database>,
  reportKey: string,
  range: DateRange,
  params?: ReportParams
): Promise<ChartPreview> {
  if (reportKey === "campaign_delivery" || reportKey === "campaign_statistics") {
    return {
      mode: "items",
      title: "Campaign Delivery Report",
      items: await buildCampaignItems(supabase, range, params?.campaignId),
    };
  }

  if (reportKey === "profile_statistics") {
    return { mode: "items", title: "Profile Statistics Report", items: await buildProfileStatItems(supabase, range) };
  }

  if (reportKey === "survey_results") {
    let responseQuery = supabase
      .from("survey_responses")
      .select("rating, surveys!inner(campaign_id)")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to));
    if (params?.campaignId) responseQuery = responseQuery.eq("surveys.campaign_id", params.campaignId);
    const { data } = await responseQuery;
    const rows = data ?? [];
    const categories = [1, 2, 3, 4, 5].map((star) => ({
      label: `${star}★`,
      value: rows.filter((r) => r.rating === star).length,
    }));
    return { mode: "aggregate", title: "Rating distribution", categories };
  }

  if (reportKey === "srs_overview") {
    const { agents, top5 } = await buildAgentOverview(supabase, range);
    return { mode: "agents", title: "SRS Overview Report", metrics: AGENT_METRICS, agents, top5 };
  }

  // account_statistics (default): part-to-whole breakdowns, one entry per
  // account in scope — just the selected one, or every account when the
  // filter is "All accounts" (pageable, not silently the first one).
  let accountQuery = supabase.from("accounts").select("*").order("account_name", { ascending: true });
  if (params?.accountId) accountQuery = accountQuery.eq("id", params.accountId);
  const { data: accountRows } = await accountQuery;

  return {
    mode: "breakdowns",
    title: "Account Statistics Report",
    accounts: (accountRows ?? []).map((account) => ({
      id: account.id,
      name: account.account_name,
      subtitle: account.organization_name,
      groups: accountBreakdownGroups(account),
    })),
  };
}
