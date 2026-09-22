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
    "Which agent has the highest average rating?",
    "Which campaign generated the most responses?",
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
  return `Ask me about ${reportLabel || "this report"}'s totals, comparisons, or trends — or click a chart to analyze it.`;
}

// A fenced ```chart block (the model's convention for "return structured
// chart data instead of prose" — see the system prompt) containing
// {"type":"bar"|"donut"|"pie","categories":[{"label","value"}...]}. The
// system prompt asks for a chart-only reply, but a compound question
// ("summarize AND chart this") can still get both — so this pulls out
// whatever text surrounds the fence (trimmed) alongside the chart,
// instead of the caller assuming a chart match means there's no prose
// left to show.
function parseChartReply(text: string): { prose: string; chart: { type: "bar" | "donut" | "pie"; categories: ChartCategory[] } | null } {
  const match = text.match(/```chart\s*([\s\S]*?)```/);
  if (!match) return { prose: text, chart: null };
  const prose = (text.slice(0, match.index) + text.slice((match.index ?? 0) + match[0].length)).trim();
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && Array.isArray(parsed.categories) && parsed.categories.length > 0) return { prose, chart: parsed };
  } catch {
    // Not valid JSON — fall through and render the raw text instead.
  }
  return { prose: text, chart: null };
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
    // Bounded to a flex column at lg (matching the parent's lg:h-full
    // column) so only the message list below scrolls internally — the
    // header, suggestions, and input stay fixed in place instead of
    // getting carried along by the whole card scrolling as one block.
    <Card className="border-indigo-200 lg:flex lg:h-full lg:flex-col lg:min-h-0">
      <CardContent className="pt-2 space-y-2.5 lg:flex lg:flex-1 lg:min-h-0 lg:flex-col">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <MessageCircle className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            <div>
              <p className="font-bold text-xs leading-tight">Report analyst</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Ask about {reportLabel || "this report"}</p>
            </div>
          </div>
          {turns.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-6 px-2 text-[11px]"
              onClick={() => setTurns([{ role: "assistant", text: openingMessage(reportLabel) }])}
            >
              <Eraser className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto pr-1 lg:max-h-none lg:flex-1 lg:min-h-0">
          {turns.map((t, i) => {
            const { prose, chart } = t.role === "assistant" ? parseChartReply(t.text) : { prose: t.text, chart: null };
            // The user's own question is a compact, right-aligned bubble
            // (like a normal chat UI) instead of a full-width block, so it
            // doesn't eat width the assistant's actual answer content needs.
            if (t.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-[11px] leading-snug max-w-[80%]">
                    {prose}
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="bg-amber-50 text-amber-950 rounded-xl px-3 py-2 text-xs leading-snug space-y-2">
                {prose && <p className="whitespace-pre-wrap">{prose}</p>}
                {chart &&
                  (chart.type === "bar" ? (
                    <CategoryBars categories={chart.categories} />
                  ) : (
                    <CategoryPie categories={chart.categories} donut={chart.type === "donut"} />
                  ))}
              </div>
            );
          })}
          {loading && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1 shrink-0">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="text-left text-[11px] font-medium px-2 py-0.5 rounded-full border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
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
          className="flex gap-1.5 shrink-0"
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
