import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportData } from "@/lib/reports/data";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type Anthropic from "@anthropic-ai/sdk";

// SECURITY: no auth check — see README.md "Admin console has no login".
export async function POST(req: NextRequest) {
  const { question } = (await req.json()) as { question: string };
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });

  const supabase = createAdminClient();
  const report = await buildReportData(supabase);

  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 500,
    system: `You are the Report Analyst for the Experience.com admin console. Answer the admin's question using ONLY the JSON report data provided below — never invent numbers that aren't there. If the data doesn't answer the question, say so plainly and suggest what to check instead. Be concise (2-5 sentences), and cite specific numbers from the data when relevant.

Report data:
${JSON.stringify(report, null, 2)}`,
    messages: [{ role: "user", content: question.trim() }],
  });

  const answer = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return NextResponse.json({ answer });
}
