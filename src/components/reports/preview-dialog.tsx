"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2, ChevronLeft, ChevronRight, Download, Sparkles } from "lucide-react";
import { CategoryBars, CategoryPie } from "@/components/reports/category-chart";
import { TrendGraph } from "@/components/reports/trend-graph";
import type { ChartCategory, ChartPreview } from "@/lib/reports/chart-preview";
import { downloadChartsAsPng, type ChartRegion } from "@/lib/reports/chart-image";
import type { ExportFormat } from "@/lib/reports/export";
import { buildExportFilename, isDateFilteredReportKey } from "@/lib/reports/filename";

type ChartType = "table" | "bar" | "donut" | "pie" | "graph";

interface TableColumn {
  key: string;
  label: string;
}
interface TableData {
  columns: TableColumn[];
  rows: Record<string, string | number>[];
  totalRows: number;
}

const NAV_BUTTON_CLASS = "rounded-full border-border shadow-sm size-8";

export function PreviewDialog({
  open,
  onOpenChange,
  reportKey,
  reportLabel,
  from,
  to,
  accountId,
  campaignId,
  profileId,
  accountLabel,
  format,
  onExported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportKey: string;
  reportLabel: string;
  from: string;
  to: string;
  accountId?: string;
  campaignId?: string;
  profileId?: string;
  accountLabel?: string;
  format: ExportFormat;
  onExported?: (exportRow: unknown) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [chartType, setChartType] = useState<ChartType>("table");
  const [index, setIndex] = useState(0);
  // SRS Overview ("agents" mode) only: which metric the Bar view compares
  // across agents, and which agent (or "all", for the Top 5% split) the
  // Donut/Pie view is scoped to.
  const [agentMetric, setAgentMetric] = useState("search_rank_score");
  // Smooths the jump when switching chart types (Table's tall grid vs. a
  // short Bar chart, etc.): the body's real height is measured and applied
  // to a fixed-height wrapper with a CSS height transition, instead of the
  // dialog just snapping to whatever height the new content happens to be.
  const bodyRef = useRef<HTMLDivElement>(null);
  const [bodyHeight, setBodyHeight] = useState<number>();
  useLayoutEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBodyHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [agentFocus, setAgentFocus] = useState("all");
  // "Analyze this chart" answers live inline in the dialog (not the page's
  // separate Report analyst chat) so the click stays put instead of closing
  // the dialog and jumping the page down to a different panel. Reset
  // whenever the chart on screen changes, since a prior answer would no
  // longer describe what's showing.
  const [chartTurns, setChartTurns] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [chartAsking, setChartAsking] = useState(false);
  const [chartFollowUp, setChartFollowUp] = useState("");

  // Fetches whenever the dialog transitions to open — driven off the `open`
  // prop itself (not the Dialog's onOpenChange callback) since this dialog
  // is opened externally by the parent setting `open=true` directly, which
  // never invokes onOpenChange (that only fires for the Dialog's own
  // internal close interactions: overlay click, Escape, etc). Both the
  // chart data and the raw table are fetched up front so switching to the
  // Table view is instant rather than triggering its own loading state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // This is the standard "effect synchronizes with an external system"
    // case the lint rule's own guidance calls out as fine (a fetch tied to
    // a prop change) — the rule can't tell that apart from a state-reset
    // effect, so it's suppressed for this one line.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      fetch("/api/reports/chart-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportKey, from, to, accountId, campaignId, profileId }),
      }).then((r) => r.json()),
      fetch("/api/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportKey, from, to, accountId, campaignId, profileId }),
      }).then((r) => r.json()),
    ])
      .then(([chartData, previewData]) => {
        if (cancelled) return;
        setPreview(chartData.preview ?? null);
        setTableData(
          previewData.report ? { ...previewData.report, totalRows: previewData.totalRows } : null
        );
        setChartType("table");
        setIndex(0);
        setAgentMetric("search_rank_score");
        setAgentFocus("all");
        setChartTurns([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, reportKey, from, to, accountId, campaignId, profileId]);

  const options: { value: ChartType; label: string }[] = [
    { value: "table", label: "Table" },
    { value: "bar", label: "Bar" },
    { value: "donut", label: "Donut" },
    { value: "pie", label: "Pie" },
    ...(preview?.mode === "items" ? [{ value: "graph" as const, label: "Graph" }] : []),
  ];

  const item = preview?.mode === "items" ? preview.items[index] : null;
  const account = preview?.mode === "breakdowns" ? preview.accounts[index] : null;

  function toRegion(mode: "bar" | "donut" | "pie", categories: ChartCategory[]): ChartRegion {
    if (mode === "bar") return { type: "bar", categories };
    return { type: "pie", categories, donut: mode === "donut" };
  }

  function chartCells(): { label: string; region: ChartRegion }[] {
    if (!preview || chartType === "table") return [];
    if (preview.mode === "aggregate") {
      const primary = { label: preview.title, region: toRegion(chartType as "bar" | "donut" | "pie", preview.categories) };
      const groupCells = (preview.groups ?? []).map((g) => ({
        label: g.label,
        region: toRegion(chartType as "bar" | "donut" | "pie", g.categories),
      }));
      return [primary, ...groupCells];
    }
    if (preview.mode === "items" && item) {
      if (chartType === "graph") {
        return [{ label: item.name, region: { type: "line", series: item.series, seriesKeys: item.seriesKeys } }];
      }
      if (item.groups && item.groups.length > 0) {
        return item.groups.map((g) => ({ label: `${item.name} — ${g.label}`, region: toRegion(chartType as "bar" | "donut" | "pie", g.categories) }));
      }
      return [{ label: item.name, region: toRegion(chartType as "bar" | "donut" | "pie", item.breakdown) }];
    }
    if (preview.mode === "breakdowns" && account) {
      return account.groups.map((g) => ({
        label: g.label,
        region: toRegion(chartType as "bar" | "donut" | "pie", g.categories),
      }));
    }
    if (preview.mode === "agents") {
      if (chartType === "bar") {
        const metricLabel = preview.metrics.find((m) => m.key === agentMetric)?.label ?? agentMetric;
        return [
          {
            label: `${metricLabel} — all agents`,
            region: { type: "bar", categories: preview.agents.map((a) => ({ label: a.name, value: a.metrics[agentMetric] ?? 0 })) },
          },
        ];
      }
      const focusedAgent = agentFocus !== "all" ? preview.agents.find((a) => a.id === agentFocus) : null;
      const categories = focusedAgent ? focusedAgent.breakdown : preview.top5;
      const label = focusedAgent ? `${focusedAgent.name} — Search Rank Score breakdown` : "Top 5% split — all agents";
      return [{ label, region: toRegion(chartType as "donut" | "pie", categories) }];
    }
    return [];
  }

  async function handleDownload() {
    if (chartType === "table") {
      if (!tableData) return;
      setDownloading(true);
      try {
        const res = await fetch("/api/reports/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reportKey,
            format,
            from,
            to,
            accountId,
            campaignId,
            profileId,
            accountLabel,
            requestedByLabel: profileId ? accountLabel : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? "Export failed");
          return;
        }
        toast.success(`${reportLabel} exported (${data.export.row_count} rows)`);
        onExported?.(data.export);
        if (data.url) window.open(data.url, "_blank");
      } finally {
        setDownloading(false);
      }
      return;
    }

    const cells = chartCells();
    if (cells.length === 0) return;
    const subtitle = item?.name ?? account?.name;
    const dateFiltered = isDateFilteredReportKey(reportKey);
    // The "account" slot in the filename only applies to account-scoped
    // reports — for a paged breakdown it's whichever account is on screen,
    // falling back to the explicit filter (e.g. a single selected account),
    // and to "All Accounts" for report types with no account concept at all
    // (campaign/profile items shouldn't have their item name mislabeled as
    // an account there).
    const filenameAccountLabel = preview?.mode === "breakdowns" ? (account?.name ?? accountLabel) : accountLabel;
    const filename = buildExportFilename({
      reportLabel,
      accountLabel: filenameAccountLabel,
      rangeStart: dateFiltered ? from : null,
      rangeEnd: dateFiltered ? to : null,
      extension: "png",
    });
    downloadChartsAsPng(filename, subtitle ? `${reportLabel} — ${subtitle}` : reportLabel, cells);
  }

  async function askChartQuestion(question: string) {
    const cells = chartCells();
    if (cells.length === 0 || chartAsking) return;
    // A small, already-aggregated snapshot of exactly what's on screen —
    // not a fresh DB fetch — so the analyst can explain this chart for
    // free before deciding whether it needs to query for more.
    const data = cells.map((c) => ({
      label: c.label,
      ...(c.region.type === "line"
        ? { series: c.region.series, seriesKeys: c.region.seriesKeys.map((s) => ({ key: s.key, label: s.label })) }
        : { categories: c.region.categories }),
    }));
    const subtitle = item?.name ?? account?.name;
    const label = subtitle ? `${reportLabel} — ${subtitle}` : reportLabel;
    const history = chartTurns.map((t) => ({ role: t.role, text: t.text }));
    setChartTurns((t) => [...t, { role: "user", text: question }]);
    setChartAsking(true);
    const res = await fetch("/api/reports/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, reportKey, from, to, accountId, campaignId, profileId, accountLabel, history, chartContext: data, chartLabel: label }),
    });
    const resData = await res.json();
    setChartAsking(false);
    setChartTurns((t) => [...t, { role: "assistant", text: res.ok ? resData.answer : `Error: ${resData.error}` }]);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl min-w-0 max-h-[90vh] overflow-y-auto" closeButtonClassName={NAV_BUTTON_CLASS}>
        <DialogHeader>
          <DialogTitle>Preview — {reportLabel}</DialogTitle>
        </DialogHeader>

        <div
          className="max-h-[60vh] overflow-y-auto transition-[height] duration-200 ease-out"
          style={{ height: bodyHeight }}
        >
        <div ref={bodyRef}>

        {loading && (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && chartType === "table" && tableData && (
          <div className="space-y-4 min-w-0">
            <p className="text-xs text-muted-foreground">
              Showing {tableData.rows.length} of {tableData.totalRows} rows
            </p>
            {/* min-w-0 is required here: DialogContent is a grid, and grid
                items default to min-width:auto, which stops overflow-x-auto
                from ever kicking in — the table just grows the dialog wider
                instead of scrolling internally. */}
            <div className="rounded-lg border max-h-[55vh] overflow-y-auto overflow-x-auto min-w-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    {tableData.columns.map((c) => (
                      <TableHead key={c.key} className="whitespace-nowrap">
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.rows.map((row, i) => (
                    <TableRow key={i}>
                      {tableData.columns.map((c) => (
                        <TableCell key={c.key} className="whitespace-nowrap">
                          {row[c.key]}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {tableData.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={tableData.columns.length} className="text-center py-8 text-muted-foreground">
                        No rows to show.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        {!loading && chartType !== "table" && preview?.mode === "aggregate" && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold mb-2">{preview.title}</p>
              {chartType === "bar" && <CategoryBars categories={preview.categories} />}
              {chartType === "donut" && <CategoryPie categories={preview.categories} donut />}
              {chartType === "pie" && <CategoryPie categories={preview.categories} donut={false} />}
            </div>
            {preview.groups && preview.groups.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-5 max-h-[40vh] overflow-y-auto pr-1">
                {preview.groups.map((g) => (
                  <div key={g.label} className="rounded-lg border p-3">
                    <p className="text-xs font-semibold mb-2">{g.label}</p>
                    {chartType === "bar" && <CategoryBars categories={g.categories} />}
                    {chartType === "donut" && <CategoryPie categories={g.categories} donut />}
                    {chartType === "pie" && <CategoryPie categories={g.categories} donut={false} />}
                  </div>
                ))}
              </div>
            )}
            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        {!loading && chartType !== "table" && preview?.mode === "items" && item && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              {preview.items.length > 1 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className={NAV_BUTTON_CLASS}
                  disabled={index === 0}
                  onClick={() => { setIndex((i) => Math.max(0, i - 1)); setChartTurns([]); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <div className="size-8" />
              )}
              <div className="text-center">
                <p className="font-bold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.items.length > 1
                    ? `${reportKey === "profile_statistics" ? "Profile" : "Campaign"} ${index + 1} of ${preview.items.length} · `
                    : ""}
                  {item.subtitle}
                </p>
              </div>
              {preview.items.length > 1 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className={NAV_BUTTON_CLASS}
                  disabled={index === preview.items.length - 1}
                  onClick={() => { setIndex((i) => Math.min(preview.items.length - 1, i + 1)); setChartTurns([]); }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="size-8" />
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {item.stats.map((s) => (
                <Card key={s.label}>
                  <CardContent className="py-3 text-center">
                    <p className="text-lg font-extrabold">{s.value}</p>
                    <p className="text-[11px] text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {chartType !== "graph" && item.groups && item.groups.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-5 max-h-[45vh] overflow-y-auto pr-1">
                {item.groups.map((g) => (
                  <div key={g.label} className="rounded-lg border p-3">
                    <p className="text-xs font-semibold mb-2">{g.label}</p>
                    {chartType === "bar" && <CategoryBars categories={g.categories} />}
                    {chartType === "donut" && <CategoryPie categories={g.categories} donut />}
                    {chartType === "pie" && <CategoryPie categories={g.categories} donut={false} />}
                  </div>
                ))}
              </div>
            )}
            {chartType !== "graph" && !item.groups && (
              <>
                {chartType === "bar" && <CategoryBars categories={item.breakdown} />}
                {chartType === "donut" && <CategoryPie categories={item.breakdown} donut />}
                {chartType === "pie" && <CategoryPie categories={item.breakdown} donut={false} />}
              </>
            )}
            {chartType === "graph" && <TrendGraph series={item.series} seriesKeys={item.seriesKeys} />}

            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        {!loading && chartType !== "table" && preview?.mode === "items" && preview.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No {reportKey === "profile_statistics" ? "profile stats" : "campaigns"} in this date range.
          </p>
        )}

        {!loading && chartType !== "table" && preview?.mode === "breakdowns" && account && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              {preview.accounts.length > 1 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className={NAV_BUTTON_CLASS}
                  disabled={index === 0}
                  onClick={() => { setIndex((i) => Math.max(0, i - 1)); setChartTurns([]); }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <div className="size-8" />
              )}
              <div className="text-center">
                <p className="font-bold">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.accounts.length > 1 ? `Account ${index + 1} of ${preview.accounts.length} · ` : ""}
                  {account.subtitle}
                </p>
              </div>
              {preview.accounts.length > 1 ? (
                <Button
                  variant="outline"
                  size="icon"
                  className={NAV_BUTTON_CLASS}
                  disabled={index === preview.accounts.length - 1}
                  onClick={() => { setIndex((i) => Math.min(preview.accounts.length - 1, i + 1)); setChartTurns([]); }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="size-8" />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-5 max-h-[55vh] overflow-y-auto pr-1">
              {account.groups.map((g) => (
                <div key={g.label} className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-2">{g.label}</p>
                  {chartType === "bar" && <CategoryBars categories={g.categories} />}
                  {chartType === "donut" && <CategoryPie categories={g.categories} donut />}
                  {chartType === "pie" && <CategoryPie categories={g.categories} donut={false} />}
                </div>
              ))}
            </div>
            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        {!loading && chartType !== "table" && preview?.mode === "breakdowns" && preview.accounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No accounts to show yet.</p>
        )}

        {!loading && chartType !== "table" && preview?.mode === "agents" && preview.agents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No agents ranked yet.</p>
        )}

        {!loading && chartType === "bar" && preview?.mode === "agents" && preview.agents.length > 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Metric</p>
              <Select value={agentMetric} onValueChange={(v) => { setAgentMetric(v); setChartTurns([]); }}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {preview.metrics.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[45vh] overflow-y-auto pr-1">
              <CategoryBars categories={preview.agents.map((a) => ({ label: a.name, value: a.metrics[agentMetric] ?? 0 }))} />
            </div>
            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        {!loading && (chartType === "donut" || chartType === "pie") && preview?.mode === "agents" && preview.agents.length > 0 && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">Agent</p>
              <Select value={agentFocus} onValueChange={(v) => { setAgentFocus(v); setChartTurns([]); }}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents — Top 5% split</SelectItem>
                  {preview.agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} — Search Rank Score breakdown
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {agentFocus === "all" ? (
              <CategoryPie categories={preview.top5} donut={chartType === "donut"} />
            ) : (
              <CategoryPie
                categories={preview.agents.find((a) => a.id === agentFocus)?.breakdown ?? []}
                donut={chartType === "donut"}
              />
            )}
            <ToolbarRow options={options} value={chartType} onChange={(v) => { setChartType(v); setChartTurns([]); }} onDownload={handleDownload} downloading={downloading} chartTurns={chartTurns} chartAsking={chartAsking} chartFollowUp={chartFollowUp} onChartFollowUpChange={setChartFollowUp} onAsk={askChartQuestion} />
          </div>
        )}

        </div>
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground">Click outside this panel to go back to Reports.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ANALYZE_QUESTION = "Analyze this chart: explain trends, spikes, drops, outliers, and any notable comparisons, concisely.";

function ToolbarRow({
  options,
  value,
  onChange,
  onDownload,
  downloading,
  chartTurns,
  chartAsking,
  chartFollowUp,
  onChartFollowUpChange,
  onAsk,
}: {
  options: { value: ChartType; label: string }[];
  value: ChartType;
  onChange: (v: ChartType) => void;
  onDownload: () => void;
  downloading: boolean;
  chartTurns: { role: "user" | "assistant"; text: string }[];
  chartAsking: boolean;
  chartFollowUp: string;
  onChartFollowUpChange: (v: string) => void;
  onAsk: (question: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ChartTypeToggle options={options} value={value} onChange={onChange} />
        <div className="flex items-center gap-2">
          {value !== "table" && chartTurns.length === 0 && (
            <Button variant="outline" size="sm" onClick={() => onAsk(ANALYZE_QUESTION)} disabled={chartAsking}>
              {chartAsking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Analyze this chart
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
            {value === "table" ? "Download report" : "Download chart"}
          </Button>
        </div>
      </div>

      {value !== "table" && chartTurns.length > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 space-y-2.5">
          {chartTurns.map((t, i) => (
            <p key={i} className={t.role === "assistant" ? "text-sm text-indigo-950 leading-relaxed" : "text-sm font-semibold text-indigo-700"}>
              {t.role === "user" ? `You: ${t.text}` : t.text}
            </p>
          ))}
          {chartAsking && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = chartFollowUp.trim();
              if (!q || chartAsking) return;
              onAsk(q);
              onChartFollowUpChange("");
            }}
            className="flex gap-2 pt-1"
          >
            <Input
              value={chartFollowUp}
              onChange={(e) => onChartFollowUpChange(e.target.value)}
              placeholder="Ask a follow-up…"
              disabled={chartAsking}
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" disabled={chartAsking || !chartFollowUp.trim()}>
              Ask
            </Button>
          </form>
        </div>
      )}
    </>
  );
}

function ChartTypeToggle({
  options,
  value,
  onChange,
}: {
  options: { value: ChartType; label: string }[];
  value: ChartType;
  onChange: (v: ChartType) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1 gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "text-xs font-semibold px-3.5 py-1.5 rounded-full transition-colors",
            value === o.value ? "bg-indigo-600 text-white" : "text-muted-foreground hover:bg-background"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
