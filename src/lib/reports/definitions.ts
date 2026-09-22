import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { completenessOf } from "@/lib/profile-fields";

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
  from: string; // ISO date
  to: string; // ISO date
}

export interface ReportDefinition {
  key: string;
  label: string;
  description: string;
  fetch: (supabase: SupabaseClient<Database>, range: DateRange) => Promise<ReportResult>;
}

function fmt(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString() : "";
}

const accountStatistics: ReportDefinition = {
  key: "account_statistics",
  label: "Account Statistics Report",
  description: "Every profile with status, completeness, and key dates.",
  async fetch(supabase, range) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .gte("created_at", range.from)
      .lte("created_at", range.to)
      .order("created_at", { ascending: false });
    const rows = (data ?? []).map((p) => ({
      name: p.name,
      profession: p.profession,
      organization: p.org,
      location: p.location,
      status: p.status,
      completeness: `${completenessOf(p)}%`,
      created: fmt(p.created_at),
      claimed: fmt(p.claimed_at),
    }));
    return {
      columns: [
        { key: "name", label: "Name" },
        { key: "profession", label: "Profession" },
        { key: "organization", label: "Organization" },
        { key: "location", label: "Location" },
        { key: "status", label: "Status" },
        { key: "completeness", label: "Completeness" },
        { key: "created", label: "Created" },
        { key: "claimed", label: "Claimed" },
      ],
      rows,
      summaryLabel: `Account Statistics · ${range.from} to ${range.to} · ${rows.length} profiles included.`,
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
      .lte("created_at", range.to)
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
      .lte("created_at", range.to)
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
      .lte("created_at", range.to)
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
      .lte("created_at", range.to);

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

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  accountStatistics,
  campaignDeliveryStatus,
  campaignStatistics,
  surveyResults,
  srsOverview,
];

export function getReportDefinition(key: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((r) => r.key === key);
}
