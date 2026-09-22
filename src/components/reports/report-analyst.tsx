"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2 } from "lucide-react";

interface Turn {
  role: "assistant" | "user";
  text: string;
}

const SUGGESTIONS = [
  "Why don't I see an account I expect?",
  "Does this report cover a date range?",
  "What formats can I export this in?",
];

function openingMessage(reportLabel: string) {
  return `Hi, I'm your report analyst. Ask about your numbers, or how ${reportLabel || "this report"} works — what a column means, why something's missing, or what format you can export in.`;
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
}: {
  reportKey: string;
  reportLabel: string;
  from: string;
  to: string;
  accountId?: string;
}) {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([{ role: "assistant", text: openingMessage(reportLabel) }]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setQuestion("");
    setTurns((t) => [...t, { role: "user", text }]);
    const res = await fetch("/api/reports/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text, reportKey, from, to, accountId }),
    });
    const data = await res.json();
    setLoading(false);
    setTurns((t) => [...t, { role: "assistant", text: res.ok ? data.answer : `Error: ${data.error}` }]);
  }

  return (
    <Card className="border-indigo-200">
      <CardContent className="pt-2 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <MessageCircle className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="font-bold text-sm">Report analyst</p>
            <p className="text-xs text-muted-foreground">Ask about {reportLabel || "this report"}</p>
          </div>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div
              key={i}
              className={
                t.role === "assistant"
                  ? "bg-amber-50 text-amber-950 rounded-xl px-4 py-3 text-sm leading-relaxed"
                  : "bg-indigo-600 text-white rounded-xl px-4 py-3 text-sm leading-relaxed ml-8"
              }
            >
              {t.text}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => ask(s)}
              disabled={loading}
              className="text-left text-sm font-medium px-4 py-2.5 rounded-full border bg-muted/40 hover:bg-muted transition-colors disabled:opacity-50"
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
