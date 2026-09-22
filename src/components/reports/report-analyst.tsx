"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, Eraser } from "lucide-react";
import { CategoryBars, CategoryPie } from "@/components/reports/category-chart";
import type { ChartCategory } from "@/lib/reports/chart-preview";

interface Turn {
  role: "assistant" | "user";
  text: string;
}

// Generic examples from the same family as the ones product asked for
// ("What is the total number of reviews?" / "How many responses came from
// California?" / "What was the NPS last month?" / "Which agent had the
// highest score?"), reworded per report so they're real, askable questions
// against this app's actual columns.
const SUGGESTIONS_BY_REPORT: Record<string, string[]> = {
  account_statistics: [
    "Which account has the most active campaigns?",
    "What's the average completion rate across accounts?",
    "How many accounts have missing GMB listings?",
  ],
  campaign_delivery: [
    "How many sends were completed vs. still pending?",
    "Which agent handled the most sends?",
    "Compare survey sources — which is most common?",
  ],
  campaign_statistics: [
    "Which campaign has the highest open rate?",
    "What's the total number of sends across all campaigns?",
    "Compare this campaign's clicks to last month.",
  ],
  survey_results: [
    "What's the average rating?",
    "How many 5-star responses are there?",
    "Which survey has the most responses?",
  ],
  srs_overview: [
    "Which agent has the highest Search Rank Score?",
    "What percentage of agents are Top 5%?",
    "Compare two agents' scores.",
  ],
  profile_statistics: [
    "Which profile has the most views?",
    "What's the average Search Rank Score?",
    "How has this profile's score changed over time?",
  ],
};

function openingMessage(reportLabel: string) {
  return `Hi, I'm your report analyst. Ask me anything about ${reportLabel || "this report"}'s data — totals, comparisons, trends, or click a chart and ask me to analyze it.`;
}

// A fenced ```chart block (the model's convention for "return structured
// chart data instead of prose" — see the system prompt) containing
// {"type":"bar"|"donut"|"pie","categories":[{"label","value"}...]}.
function parseChartReply(text: string): { type: "bar" | "donut" | "pie"; categories: ChartCategory[] } | null {
  const match = text.match(/```chart\s*([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && Array.isArray(parsed.categories)) return parsed;
  } catch {
    // Not valid JSON — fall through and render as plain text instead.
  }
  return null;
}

// The parent renders this with `key={reportKey}` so switching reports
// remounts it with fresh state, instead of syncing `turns` to `reportKey`
// via an effect.
export function ReportAnalyst({
  reportKey,
  reportLabel,
  from,
  to,
  accountId,
  campaignId,
  profileId,
  accountLabel,
}: {
  reportKey: string;
  reportLabel: string;
  from: string;
  to: string;
  accountId?: string;
  campaignId?: string;
  profileId?: string;
  accountLabel?: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", text: openingMessage(reportLabel) }]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string, opts?: { chartContext?: unknown; chartLabel?: string }) {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setQuestion("");
    // Prior turns only — the new question is sent separately below, so
    // the server can tell "first turn" (send full Context) from a
    // follow-up (Question only, reusing context already in the
    // transcript) per the token-efficient prompt design.
    const history = turns.map((t) => ({ role: t.role, text: t.text }));
    setTurns((t) => [...t, { role: "user", text }]);
    const res = await fetch("/api/reports/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: text,
        reportKey,
        from,
        to,
        accountId,
        campaignId,
        profileId,
        accountLabel,
        history,
        chartContext: opts?.chartContext,
        chartLabel: opts?.chartLabel,
      }),
    });
    const data = await res.json();
    setLoading(false);
    setTurns((t) => [...t, { role: "assistant", text: res.ok ? data.answer : `Error: ${data.error}` }]);
  }

  const suggestions = SUGGESTIONS_BY_REPORT[reportKey] ?? ["Summarize this report.", "What stands out most in this data?"];

  return (
    <Card className="border-indigo-200">
      <CardContent className="pt-2 space-y-4">
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <MessageCircle className="h-4 w-4 text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-sm">Report analyst</p>
              <p className="text-xs text-muted-foreground">Ask about {reportLabel || "this report"}</p>
            </div>
          </div>
          {turns.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setTurns([{ role: "assistant", text: openingMessage(reportLabel) }])}
            >
              <Eraser className="h-3.5 w-3.5 mr-1.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {turns.map((t, i) => {
            const chart = t.role === "assistant" ? parseChartReply(t.text) : null;
            return (
              <div
                key={i}
                className={
                  t.role === "assistant"
                    ? "bg-amber-50 text-amber-950 rounded-xl px-4 py-3 text-sm leading-relaxed"
                    : "bg-indigo-600 text-white rounded-xl px-4 py-3 text-sm leading-relaxed ml-8"
                }
              >
                {chart ? (
                  chart.type === "bar" ? (
                    <CategoryBars categories={chart.categories} />
                  ) : (
                    <CategoryPie categories={chart.categories} donut={chart.type === "donut"} />
                  )
                ) : (
                  t.text
                )}
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="text-left text-xs font-medium px-2.5 py-1 rounded-full border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this report…"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
