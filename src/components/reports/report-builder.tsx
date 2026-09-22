"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Download, Eye } from "lucide-react";
import { ReportAnalyst } from "@/components/reports/report-analyst";
import { PreviewDialog } from "@/components/reports/preview-dialog";

interface ReportOption {
  key: string;
  label: string;
  description: string;
}

interface AccountOption {
  id: string;
  account_name: string;
  organization_name: string;
}

interface CampaignOption {
  id: string;
  name: string;
}

const ACCOUNT_FILTER_REPORT_KEYS = new Set(["account_statistics"]);
// Kept in sync with isDateFilteredReport() in lib/reports/definitions.ts —
// that module is server-only, so this client component can't import it.
// Unlike that function (every report except account_statistics), the date
// range is only user-adjustable for these three; the rest keep the fixed
// last-90-days default.
const DATE_FILTER_REPORT_KEYS = new Set(["campaign_delivery", "campaign_statistics", "survey_results", "profile_statistics"]);
const CAMPAIGN_FILTER_REPORT_KEYS = new Set(["campaign_delivery", "survey_results"]);

interface ExportRow {
  id: string;
  report_label: string;
  format: string;
  requested_by_label: string;
  row_count: number;
  range_start: string | null;
  range_end: string | null;
  created_at: string;
}

const FORMATS = [
  { value: "xlsx", label: "XLSX" },
  { value: "csv", label: "CSV" },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const today = new Date();
const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

export function ReportBuilder({
  reportOptions,
  initialExports,
  accounts,
  campaigns,
  profileId,
  profileName,
}: {
  reportOptions: ReportOption[];
  initialExports: ExportRow[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  // Set only by the "view as" reports page: fixes every fetch/export/
  // analyst call to this one profile, and stands in for the account
  // filter (which doesn't apply at the user level) in filenames.
  profileId?: string;
  profileName?: string;
}) {
  const [reportKey, setReportKey] = useState(reportOptions[0]?.key ?? "");
  const [accountId, setAccountId] = useState<string>("all");
  const [campaignId, setCampaignId] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState(isoDate(ninetyDaysAgo));
  const [customTo, setCustomTo] = useState(isoDate(today));
  const [format, setFormat] = useState("xlsx");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exports, setExports] = useState(initialExports);

  const range = { from: customFrom, to: customTo };
  const selected = reportOptions.find((r) => r.key === reportKey);
  const showAccountFilter = ACCOUNT_FILTER_REPORT_KEYS.has(reportKey);
  const showDateFilter = DATE_FILTER_REPORT_KEYS.has(reportKey);
  const showCampaignFilter = CAMPAIGN_FILTER_REPORT_KEYS.has(reportKey);
  const effectiveAccountId = showAccountFilter && accountId !== "all" ? accountId : undefined;
  const effectiveCampaignId = showCampaignFilter && campaignId !== "all" ? campaignId : undefined;
  const accountLabel = profileId
    ? profileName
    : effectiveAccountId
    ? accounts.find((a) => a.id === effectiveAccountId)?.account_name
    : undefined;

  async function exportReport() {
    setExporting(true);
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reportKey,
        format,
        ...range,
        accountId: effectiveAccountId,
        campaignId: effectiveCampaignId,
        profileId,
        accountLabel,
      }),
    });
    const data = await res.json();
    setExporting(false);
    if (!res.ok) {
      toast.error(data.error ?? "Export failed");
      return;
    }
    toast.success(`${selected?.label} exported (${data.export.row_count} rows)`);
    setExports((prev) => [data.export, ...prev]);
    if (data.url) window.open(data.url, "_blank");
  }

  return (
    // The parent page gives this a definite height (h-full, down from the
    // admin shell's fixed viewport height) instead of letting it grow to
    // content — that's what makes `h-full` here mean something real, so
    // each column can bound its OWN overflow (the left column scrolls in
    // the rare case its form + analyst don't fit; Recent exports' list
    // always does) instead of the page never fitting and forcing the
    // whole admin shell to scroll.
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 h-full">
      <div className="space-y-6 lg:h-full lg:overflow-y-auto lg:pr-1">
        <Card>
          <CardContent className="pt-2 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Select report</p>
                <Select value={reportKey} onValueChange={setReportKey}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportOptions.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Report format</p>
                <Select value={format} onValueChange={setFormat}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showAccountFilter && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Account</p>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts</SelectItem>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_name} · {a.organization_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {showDateFilter && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">From</p>
                    <Input
                      type="date"
                      value={customFrom}
                      max={customTo}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">To</p>
                    <Input
                      type="date"
                      value={customTo}
                      min={customFrom}
                      max={isoDate(today)}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </>
              )}

              {showCampaignFilter && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-muted-foreground mb-1.5">Campaign</p>
                  <Select value={campaignId} onValueChange={setCampaignId}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All campaigns</SelectItem>
                      {campaigns.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={exportReport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                {exporting ? "Exporting…" : "Export report"}
              </Button>
              <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                <Eye className="h-4 w-4 mr-1.5" />
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>

        <PreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          reportKey={reportKey}
          reportLabel={selected?.label ?? ""}
          from={range.from}
          to={range.to}
          accountId={effectiveAccountId}
          campaignId={effectiveCampaignId}
          profileId={profileId}
          accountLabel={accountLabel}
          format={format as "xlsx" | "csv"}
          onExported={(row) => setExports((prev) => [row as ExportRow, ...prev])}
        />

        <ReportAnalyst
          key={`${reportKey}:${effectiveAccountId ?? "all"}:${effectiveCampaignId ?? "all"}:${profileId ?? "all"}:${range.from}:${range.to}`}
          reportKey={reportKey}
          reportLabel={selected?.label ?? ""}
          from={range.from}
          to={range.to}
          accountId={effectiveAccountId}
          campaignId={effectiveCampaignId}
          profileId={profileId}
          accountLabel={accountLabel}
        />
      </div>

      <Card className="lg:flex lg:flex-col lg:min-h-0">
        <CardContent className="pt-2 lg:flex lg:flex-col lg:min-h-0 lg:h-full">
          <p className="font-bold text-sm mb-3 shrink-0">Recent exports</p>
          <div className="space-y-3 overflow-y-auto pr-1 lg:flex-1 lg:min-h-0">
            {exports.map((e) => (
              <div key={e.id} className="rounded-lg border py-3 px-3.5 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm">
                    <span className="font-semibold">{e.requested_by_label}</span> downloaded{" "}
                    <span className="font-semibold">{e.report_label}</span>
                    {e.range_start && e.range_end ? ` from ${e.range_start} – ${e.range_end}` : ""}
                  </p>
                  <span className="text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded px-1.5 py-0.5 shrink-0">
                    {e.format}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <a
                    href={`/api/reports/exports/${e.id}/download`}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    Download Report
                  </a>
                  <span className="text-xs text-muted-foreground">{timeAgo(e.created_at)}</span>
                </div>
              </div>
            ))}
            {exports.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No exports yet.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}
