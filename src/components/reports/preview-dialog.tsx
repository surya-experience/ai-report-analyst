"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { CategoryBars, CategoryPie } from "@/components/reports/category-chart";
import { TrendGraph } from "@/components/reports/trend-graph";
import type { ChartPreview } from "@/lib/reports/chart-preview";

type ChartType = "bar" | "donut" | "pie" | "graph";

export function PreviewDialog({
  open,
  onOpenChange,
  reportKey,
  reportLabel,
  isItemModeReport,
  from,
  to,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportKey: string;
  reportLabel: string;
  isItemModeReport: boolean;
  from: string;
  to: string;
  accountId?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ChartPreview | null>(null);
  const [chartType, setChartType] = useState<ChartType>(isItemModeReport ? "graph" : "bar");
  const [index, setIndex] = useState(0);

  // Fetches whenever the dialog transitions to open — driven off the `open`
  // prop itself (not the Dialog's onOpenChange callback) since this dialog
  // is opened externally by the parent setting `open=true` directly, which
  // never invokes onOpenChange (that only fires for the Dialog's own
  // internal close interactions: overlay click, Escape, etc).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // This is the standard "effect synchronizes with an external system"
    // case the lint rule's own guidance calls out as fine (a fetch tied to
    // a prop change) — the rule can't tell that apart from a state-reset
    // effect, so it's suppressed for this one line.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    fetch("/api/reports/chart-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportKey, from, to, accountId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setPreview(data.preview ?? null);
        setChartType(isItemModeReport ? "graph" : "bar");
        setIndex(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reportKey, from, to, accountId]);

  const options: { value: ChartType; label: string }[] =
    preview?.mode === "items"
      ? [
          { value: "bar", label: "Bar" },
          { value: "donut", label: "Donut" },
          { value: "pie", label: "Pie" },
          { value: "graph", label: "Graph" },
        ]
      : [
          { value: "bar", label: "Bar" },
          { value: "donut", label: "Donut" },
          { value: "pie", label: "Pie" },
        ];

  const item = preview?.mode === "items" ? preview.items[index] : null;
  const account = preview?.mode === "breakdowns" ? preview.accounts[index] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={preview?.mode === "breakdowns" ? "sm:max-w-3xl" : "sm:max-w-xl"}>
        <DialogHeader>
          <DialogTitle>Preview — {reportLabel}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="py-16 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && preview?.mode === "aggregate" && (
          <div className="space-y-6">
            {chartType === "bar" && <CategoryBars categories={preview.categories} />}
            {chartType === "donut" && <CategoryPie categories={preview.categories} donut />}
            {chartType === "pie" && <CategoryPie categories={preview.categories} donut={false} />}
            <ChartTypeToggle options={options} value={chartType} onChange={setChartType} />
          </div>
        )}

        {!loading && preview?.mode === "items" && item && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="font-bold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {reportKey === "profile_statistics" ? "Profile" : "Campaign"} {index + 1} of {preview.items.length} ·{" "}
                  {item.subtitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === preview.items.length - 1}
                onClick={() => setIndex((i) => Math.min(preview.items.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
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

            {chartType === "bar" && <CategoryBars categories={item.breakdown} />}
            {chartType === "donut" && <CategoryPie categories={item.breakdown} donut />}
            {chartType === "pie" && <CategoryPie categories={item.breakdown} donut={false} />}
            {chartType === "graph" && <TrendGraph series={item.series} seriesKeys={item.seriesKeys} />}

            <ChartTypeToggle options={options} value={chartType} onChange={setChartType} />
          </div>
        )}

        {!loading && preview?.mode === "items" && preview.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">
            No {reportKey === "profile_statistics" ? "profile stats" : "campaigns"} in this date range.
          </p>
        )}

        {!loading && preview?.mode === "breakdowns" && account && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon"
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-center">
                <p className="font-bold">{account.name}</p>
                <p className="text-xs text-muted-foreground">
                  Account {index + 1} of {preview.accounts.length} · {account.subtitle}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={index === preview.accounts.length - 1}
                onClick={() => setIndex((i) => Math.min(preview.accounts.length - 1, i + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 max-h-[55vh] overflow-y-auto pr-1">
              {account.groups.map((g) => (
                <div key={g.label} className="rounded-lg border p-3">
                  <p className="text-xs font-semibold mb-2">{g.label}</p>
                  {chartType === "bar" && <CategoryBars categories={g.categories} />}
                  {chartType === "donut" && <CategoryPie categories={g.categories} donut />}
                  {(chartType === "pie" || chartType === "graph") && (
                    <CategoryPie categories={g.categories} donut={false} />
                  )}
                </div>
              ))}
            </div>
            <ChartTypeToggle
              options={[
                { value: "bar", label: "Bar" },
                { value: "donut", label: "Donut" },
                { value: "pie", label: "Pie" },
              ]}
              value={chartType === "graph" ? "pie" : chartType}
              onChange={setChartType}
            />
          </div>
        )}

        {!loading && preview?.mode === "breakdowns" && preview.accounts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No accounts to show yet.</p>
        )}

        <DialogFooter>
          <p className="text-xs text-muted-foreground">Click outside this panel to go back to Reports.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    <div className="inline-flex rounded-full bg-muted p-1 gap-1">
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
