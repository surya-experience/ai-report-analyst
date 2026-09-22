import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface ReportColumn {
  key: string;
  label: string;
}

export interface ReportResult {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summaryLabel: string; // e.g. "Account Statistics · last 90 days · 10 profiles included."
}

export interface DateRange {
  from: string; // ISO date, e.g. "2026-09-01"
  to: string; // ISO date, e.g. "2026-09-22"
}

export interface ReportParams {
  // Account Statistics only: filter to one account, or omit/"" for all.
  accountId?: string;
}

// `range.to` is a bare date. Compared as-is against a timestamptz column,
// Postgres treats it as that day's midnight UTC, silently excluding
// anything created later that same day — this pushes the bound to the end
// of the day so "to" is actually inclusive of it.
export function endOfDay(dateOnly: string): string {
  return `${dateOnly}T23:59:59.999Z`;
}

export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  fetch: (supabase: SupabaseClient<Database>, range: DateRange, params?: ReportParams) => Promise<ReportResult>;
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "";
}

// Matches the documented column order/labels exactly (see
// src/lib/reports/knowledge.ts) — this report is a point-in-time snapshot,
// not date-filtered (per the docs), so `range` is accepted for API
// consistency but not applied as a filter.
const accountStatistics: ReportDefinition = {
  key: "account_statistics",
  label: "Account Statistics Report",
  description: "Account and organization health snapshot — campaigns, surveys, users, publishing, and social/GMB completeness.",
  async fetch(supabase, _range, params) {
    let query = supabase.from("accounts").select("*").order("account_name", { ascending: true });
    if (params?.accountId) query = query.eq("id", params.accountId);
    const { data } = await query;

    const rows = (data ?? []).map((a) => ({
      account_name: a.account_name,
      organization_name: a.organization_name,
      number_of_tiers: a.number_of_tiers,
      number_of_locations: a.number_of_locations,
      number_of_users: a.number_of_users,
      number_of_verified_users: a.number_of_verified_users,
      number_of_active_campaigns: a.number_of_active_campaigns,
      number_of_surveys_sent: a.number_of_surveys_sent,
      number_of_surveys_completed: a.number_of_surveys_completed,
      number_of_inactive_campaigns: a.number_of_inactive_campaigns,
      tiers_published_listings: a.number_of_tiers_published_listings,
      users_published_listings: a.number_of_users_published_listings,
      tiers_published_profile_pages: a.number_of_tiers_published_profile_pages,
      users_published_profile_pages: a.number_of_users_published_profile_pages,
      number_of_mismatches: a.number_of_mismatches,
      completion_rate_pct: a.completion_rate_pct != null ? `${a.completion_rate_pct}%` : "N/A",
      tiers_facebook_connected: a.tiers_facebook_connected,
      tiers_twitter_connected: a.tiers_twitter_connected,
      tiers_linkedin_connected: a.tiers_linkedin_connected,
      agents_facebook_connected: a.agents_facebook_connected,
      agents_twitter_connected: a.agents_twitter_connected,
      agents_linkedin_connected: a.agents_linkedin_connected,
      tiers_verified_gmb: a.tiers_verified_gmb,
      tiers_missing_gmb: a.tiers_missing_gmb,
      agents_verified_gmb: a.agents_verified_gmb,
      agents_missing_gmb: a.agents_missing_gmb,
      tiers_missing_photos: a.tiers_missing_photos,
      agents_missing_photos: a.agents_missing_photos,
      tiers_missing_urls: a.tiers_missing_urls,
      agents_missing_urls: a.agents_missing_urls,
    }));

    const scopeLabel = params?.accountId
      ? rows[0]?.account_name ?? "selected account"
      : `${rows.length} account${rows.length === 1 ? "" : "s"}`;

    return {
      columns: [
        { key: "account_name", label: "Account Name" },
        { key: "organization_name", label: "Organization Name" },
        { key: "number_of_tiers", label: "Number of Tiers" },
        { key: "number_of_locations", label: "Number of Locations" },
        { key: "number_of_users", label: "Number of Users" },
        { key: "number_of_verified_users", label: "Number of Verified Users" },
        { key: "number_of_active_campaigns", label: "Number of Active campaigns" },
        { key: "number_of_surveys_sent", label: "Number of surveys sent" },
        { key: "number_of_surveys_completed", label: "Number of surveys completed" },
        { key: "number_of_inactive_campaigns", label: "Number of Inactive campaigns" },
        { key: "tiers_published_listings", label: "Number of Tiers published for listings" },
        { key: "users_published_listings", label: "Number of Users published for listings" },
        { key: "tiers_published_profile_pages", label: "Number of Tiers published for public profile pages" },
        { key: "users_published_profile_pages", label: "Number of Users published for public profile pages" },
        { key: "number_of_mismatches", label: "Number of Mismatches" },
        { key: "completion_rate_pct", label: "Completion rate %" },
        { key: "tiers_facebook_connected", label: "Number of tiers with Facebook Connected" },
        { key: "tiers_twitter_connected", label: "Number of tiers with Twitter Connected" },
        { key: "tiers_linkedin_connected", label: "Number of tiers with LinkedIn Connected" },
        { key: "agents_facebook_connected", label: "Number of agents with Facebook Connected" },
        { key: "agents_twitter_connected", label: "Number of agents with Twitter Connected" },
        { key: "agents_linkedin_connected", label: "Number of agents with LinkedIn Connected" },
        { key: "tiers_verified_gmb", label: "Number of tiers with Verified GMB" },
        { key: "tiers_missing_gmb", label: "Number of tiers Missing GMB" },
        { key: "agents_verified_gmb", label: "Number of agents with Verified GMB" },
        { key: "agents_missing_gmb", label: "Number of agents Missing GMB" },
        { key: "tiers_missing_photos", label: "Number of tiers Missing Photos" },
        { key: "agents_missing_photos", label: "Number of agents Missing Photos" },
        { key: "tiers_missing_urls", label: "Number of tiers Missing URLs" },
        { key: "agents_missing_urls", label: "Number of agents Missing URLs" },
      ],
      rows,
      summaryLabel: `Account Statistics · point-in-time snapshot · ${scopeLabel} included.`,
    };
  },
};

const campaignDeliveryStatus: ReportDefinition = {
  key: "campaign_delivery",
  label: "Campaign Delivery Status Report",
  description: "Every individual send, with its delivery status, for campaigns in range.",
  async fetch(supabase, range) {
    const { data } = await supabase
      .from("campaign_sends")
      .select("*, campaigns(name, segment), profiles(name, email)")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to))
      .order("created_at", { ascending: false })
      .limit(2000);
    const rows = (data ?? []).map((s) => {
      const campaign = s.campaigns as unknown as { name: string; segment: string } | null;
      const profile = s.profiles as unknown as { name: string; email: string | null } | null;
      return {
        campaign: campaign?.name ?? "—",
        segment: campaign?.segment ?? "—",
        recipient: profile?.name ?? "—",
        email: profile?.email ?? "—",
        status: s.status,
        sent_at: fmt(s.sent_at),
      };
    });
    return {
      columns: [
        { key: "campaign", label: "Campaign" },
        { key: "segment", label: "Segment" },
        { key: "recipient", label: "Recipient" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "sent_at", label: "Sent" },
      ],
      rows,
      summaryLabel: `Campaign Delivery Status · ${range.from} to ${range.to} · ${rows.length} sends included.`,
    };
  },
};

const campaignStatistics: ReportDefinition = {
  key: "campaign_statistics",
  label: "Campaign Statistics Report",
  description: "Per-campaign send, open, and click totals with rates.",
  async fetch(supabase, range) {
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("*")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to))
      .order("created_at", { ascending: false });

    const campaignIds = (campaigns ?? []).map((c) => c.id);
    const { data: sends } = campaignIds.length
      ? await supabase.from("campaign_sends").select("campaign_id, status").in("campaign_id", campaignIds)
      : { data: [] as { campaign_id: string; status: string }[] };

    const rows = (campaigns ?? []).map((c) => {
      const rowsForCampaign = (sends ?? []).filter((s) => s.campaign_id === c.id);
      const sent = rowsForCampaign.filter((s) => ["sent", "opened", "clicked"].includes(s.status)).length;
      const opened = rowsForCampaign.filter((s) => ["opened", "clicked"].includes(s.status)).length;
      const clicked = rowsForCampaign.filter((s) => s.status === "clicked").length;
      return {
        campaign: c.name,
        segment: c.segment,
        status: c.status,
        sent,
        opened,
        open_rate: sent ? `${Math.round((opened / sent) * 100)}%` : "—",
        clicked,
        click_rate: sent ? `${Math.round((clicked / sent) * 100)}%` : "—",
      };
    });
    return {
      columns: [
        { key: "campaign", label: "Campaign" },
        { key: "segment", label: "Segment" },
        { key: "status", label: "Status" },
        { key: "sent", label: "Sent" },
        { key: "opened", label: "Opened" },
        { key: "open_rate", label: "Open rate" },
        { key: "clicked", label: "Clicked" },
        { key: "click_rate", label: "Click rate" },
      ],
      rows,
      summaryLabel: `Campaign Statistics · ${range.from} to ${range.to} · ${rows.length} campaigns included.`,
    };
  },
};

const surveyResults: ReportDefinition = {
  key: "survey_results",
  label: "Survey Results Report",
  description: "Individual survey responses with rating and comments.",
  async fetch(supabase, range) {
    const { data } = await supabase
      .from("survey_responses")
      .select("*, surveys(name)")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to))
      .order("created_at", { ascending: false })
      .limit(2000);
    const rows = (data ?? []).map((r) => {
      const survey = r.surveys as unknown as { name: string } | null;
      return {
        survey: survey?.name ?? "—",
        respondent: r.respondent_name,
        rating: r.rating,
        comments: r.comments ?? "",
        date: fmt(r.created_at),
      };
    });
    return {
      columns: [
        { key: "survey", label: "Survey" },
        { key: "respondent", label: "Respondent" },
        { key: "rating", label: "Rating" },
        { key: "comments", label: "Comments" },
        { key: "date", label: "Date" },
      ],
      rows,
      summaryLabel: `Survey Results · ${range.from} to ${range.to} · ${rows.length} responses included.`,
    };
  },
};

const srsOverview: ReportDefinition = {
  key: "srs_overview",
  label: "SRS Overview Report",
  description: "Survey Results Summary — response counts and average rating per survey.",
  async fetch(supabase, range) {
    const { data: surveys } = await supabase.from("surveys").select("*");
    const { data: responses } = await supabase
      .from("survey_responses")
      .select("survey_id, rating, created_at")
      .gte("created_at", range.from)
      .lte("created_at", endOfDay(range.to));

    const rows = (surveys ?? []).map((s) => {
      const forSurvey = (responses ?? []).filter((r) => r.survey_id === s.id);
      const avg = forSurvey.length
        ? (forSurvey.reduce((sum, r) => sum + r.rating, 0) / forSurvey.length).toFixed(2)
        : "—";
      return {
        survey: s.name,
        responses: forSurvey.length,
        avg_rating: avg,
        five_star: forSurvey.filter((r) => r.rating === 5).length,
        one_star: forSurvey.filter((r) => r.rating === 1).length,
      };
    });
    return {
      columns: [
        { key: "survey", label: "Survey" },
        { key: "responses", label: "Responses" },
        { key: "avg_rating", label: "Avg rating" },
        { key: "five_star", label: "5-star" },
        { key: "one_star", label: "1-star" },
      ],
      rows,
      summaryLabel: `SRS Overview · ${range.from} to ${range.to} · ${rows.length} surveys included.`,
    };
  },
};

const profileStatistics: ReportDefinition = {
  key: "profile_statistics",
  label: "Profile Statistics Report",
  description: "Day-by-day ranking and visibility trend, one row per profile per day.",
  async fetch(supabase, range) {
    const { data } = await supabase
      .from("profile_daily_stats")
      .select("*, profiles(name)")
      .gte("stat_date", range.from)
      .lte("stat_date", range.to)
      .order("stat_date", { ascending: false })
      .limit(2000);
    const rows = (data ?? []).map((r) => {
      const profile = r.profiles as unknown as { name: string } | null;
      const searchRankScore =
        r.profile_completion_points + r.review_reply_points + r.connections_points + r.listings_points + r.web_analytics_points;
      return {
        profile: profile?.name ?? "—",
        date: r.stat_date,
        location_rank: r.location_rank ?? "",
        profile_views: r.profile_views,
        search_rank_score: searchRankScore,
        profile_completion_points: r.profile_completion_points,
        review_reply_points: r.review_reply_points,
        connections_points: r.connections_points,
        listings_points: r.listings_points,
        web_analytics_points: r.web_analytics_points,
        total_experience_score: r.total_experience_score ?? "",
        top_5_percent: r.top_5_percent ? "Yes" : "No",
      };
    });
    return {
      columns: [
        { key: "profile", label: "Profile" },
        { key: "date", label: "Date" },
        { key: "location_rank", label: "Location Rank" },
        { key: "profile_views", label: "Profile Views" },
        { key: "search_rank_score", label: "Search Rank Score" },
        { key: "profile_completion_points", label: "Profile Completion Points" },
        { key: "review_reply_points", label: "Review Reply Points" },
        { key: "connections_points", label: "Connections Points" },
        { key: "listings_points", label: "Listings Points" },
        { key: "web_analytics_points", label: "Web Analytics Points" },
        { key: "total_experience_score", label: "Total Experience Score" },
        { key: "top_5_percent", label: "Top 5%" },
      ],
      rows,
      summaryLabel: `Profile Statistics · ${range.from} to ${range.to} · ${rows.length} daily rows included.`,
    };
  },
};

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  accountStatistics,
  campaignDeliveryStatus,
  campaignStatistics,
  surveyResults,
  srsOverview,
  profileStatistics,
];

export function getReportDefinition(key: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((r) => r.key === key);
}
