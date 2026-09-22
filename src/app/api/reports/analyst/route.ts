import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportDefinition } from "@/lib/reports/definitions";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type Anthropic from "@anthropic-ai/sdk";

// SECURITY: no auth check — see README.md "Admin console has no login".
// The analyst is deliberately scoped to ONE report's rows at a time (the
// report currently selected on the page) rather than the whole database —
// that's what makes "ask about this report" a meaningful, checkable claim
// instead of the model reasoning over data the person can't see.
export async function POST(req: NextRequest) {
  const { question, reportKey, from, to } = (await req.json()) as {
    question: string;
    reportKey: string;
    from: string;
    to: string;
  };
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });
  const definition = getReportDefinition(reportKey);
  if (!definition) return NextResponse.json({ error: "Unknown report" }, { status: 400 });

  const supabase = createAdminClient();
  const result = await definition.fetch(supabase, { from, to });
  // Cap what goes to the model — full exports can run into the thousands
  // of rows, and the analyst only needs enough to answer well-scoped
  // questions, not a verbatim copy of the export.
  const sample = result.rows.slice(0, 300);

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    system: `You are the Report Analyst for the Experience.com admin console, currently scoped to one report: "${definition.label}" (${definition.description}).

Answer the admin's question using ONLY the report data below — never invent numbers, rows, or trends that aren't there. If the question needs data outside this report, say so and name which report would have it. Be concise (2-5 sentences), and cite specific numbers when relevant.

${result.summaryLabel}
${sample.length < result.rows.length ? `(Showing the first ${sample.length} of ${result.rows.length} rows.)\n` : ""}
Columns: ${result.columns.map((c) => c.label).join(", ")}

Rows (JSON):
${JSON.stringify(sample, null, 2)}`,
    messages: [{ role: "user", content: question.trim() }],
  });

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return NextResponse.json({ answer });
}
