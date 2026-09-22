"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";

interface Turn {
  question: string;
  answer: string;
}

const SUGGESTIONS = [
  "Which profession has the most unclaimed profiles?",
  "How is our completeness distribution looking?",
  "Which campaign performed best?",
];

export function ReportAnalyst() {
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || loading) return;
    setLoading(true);
    setQuestion("");
    const res = await fetch("/api/reports/analyst", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: text }),
    });
    const data = await res.json();
    setLoading(false);
    setTurns((t) => [...t, { question: text, answer: res.ok ? data.answer : `Error: ${data.error}` }]);
  }

  return (
    <Card className="border-indigo-200">
      <CardContent className="pt-2 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <p className="font-semibold text-sm">Report Analyst</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Ask a question about the data on this page — answers are grounded in the real numbers above.
        </p>

        {turns.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-xs px-2.5 py-1.5 rounded-full border bg-muted/50 hover:bg-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {turns.length > 0 && (
          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {turns.map((t, i) => (
              <div key={i} className="space-y-1.5">
                <p className="text-sm font-medium">{t.question}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.answer}</p>
              </div>
            ))}
          </div>
        )}

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
