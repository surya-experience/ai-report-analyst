"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Download, Eye } from "lucide-react";
import { ReportAnalyst } from "@/components/reports/report-analyst";

interface ReportOption {
  key: string;
  label: string;
  description: string;
}

interface ReportColumn {
  key: string;
  label: string;
}

interface PreviewData {
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  summaryLabel: string;
}

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
  { value: "pdf", label: "PDF" },
];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const today = new Date();
const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);

export function ReportBuilder({
  reportOptions,
  initialExports,
}: {
  reportOptions: ReportOption[];
  initialExports: ExportRow[];
}) {
  const [reportKey, setReportKey] = useState(reportOptions[0]?.key ?? "");
  const [format, setFormat] = useState("xlsx");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exports, setExports] = useState(initialExports);
  const [summaryLabel, setSummaryLabel] = useState<string | null>(null);

  const range = { from: isoDate(ninetyDaysAgo), to: isoDate(today) };
  const selected = reportOptions.find((r) => r.key === reportKey);

  async function loadPreview() {
    if (!reportKey) return;
    setLoadingPreview(true);
    const res = await fetch("/api/reports/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportKey, ...range }),
    });
    const data = await res.json();
    setLoadingPreview(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not load preview");
      return;
    }
    setPreview(data.report);
    setTotalRows(data.totalRows);
    setSummaryLabel(data.report.summaryLabel);
  }

  // Refresh the "included" summary whenever the report changes, without
  // forcing a full table preview open. The resets happen inside the fetch
  // callback (not synchronously in the effect body) so a fast report
  // switch can't have an in-flight older request clobber a newer one.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/reports/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportKey, ...range }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPreview(null);
        setSummaryLabel(data.report?.summaryLabel ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportKey]);

  async function exportReport() {
    setExporting(true);
    const res = await fetch("/api/reports/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportKey, format, ...range }),
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
    <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <div className="space-y-6">
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
            </div>

            <div className="flex gap-2">
              <Button onClick={exportReport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                {exporting ? "Exporting…" : "Export report"}
              </Button>
              <Button variant="outline" onClick={loadPreview} disabled={loadingPreview}>
                {loadingPreview ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
                Preview
              </Button>
            </div>

            {summaryLabel && (
              <div className="rounded-lg bg-indigo-50 text-indigo-900 text-sm px-4 py-3">{summaryLabel}</div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <Card>
            <CardContent className="pt-2">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">Preview</p>
                <p className="text-xs text-muted-foreground">
                  Showing {preview.rows.length} of {totalRows} rows
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.columns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.rows.map((row, i) => (
                      <TableRow key={i}>
                        {preview.columns.map((c) => (
                          <TableCell key={c.key}>{row[c.key]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {preview.rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={preview.columns.length} className="text-center py-8 text-muted-foreground">
                          No rows in this date range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <ReportAnalyst
          key={reportKey}
          reportKey={reportKey}
          reportLabel={selected?.label ?? ""}
          from={range.from}
          to={range.to}
        />
      </div>

      <div>
        <p className="font-bold text-lg mb-3">Recent exports</p>
        <div className="space-y-3">
          {exports.map((e) => (
            <Card key={e.id}>
              <CardContent className="py-3 space-y-1.5">
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
              </CardContent>
            </Card>
          ))}
          {exports.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No exports yet.</p>
          )}
        </div>
      </div>
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
