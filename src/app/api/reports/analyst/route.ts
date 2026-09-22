import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportDefinition, isDateFilteredReport, type DateRange, type ReportResult } from "@/lib/reports/definitions";
import { queryRows, type QueryArgs } from "@/lib/reports/analyst-query";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import type Anthropic from "@anthropic-ai/sdk";

// SECURITY: no auth check — see README.md "Admin console has no login".
//
// Token-efficient by design: the system prompt is the minimal "core
// prompt" below (no report documentation dump), and report data is never
// pushed up front — the model calls the query_report_data tool to pull
// exactly the aggregated/filtered slice it needs for the question at
// hand, and only re-fetches for a new date range when a comparison
// actually requires one. Conversation history is round-tripped by the
// client (this API is stateless) so a follow-up question can reuse data
// already in the transcript instead of re-querying.
const CORE_SYSTEM_PROMPT = `You are a Report Analyst. Answer using only the provided report data. Be concise, factual, and clear. Do not invent data. If data is insufficient, say so. Use calculations when needed. Mention the relevant metric/date/filter when useful.

You have a tool, query_report_data, to get the data you need — call it before answering any question that depends on data you don't already have in this conversation. Prefer aggregated/grouped results over raw rows. Never request more data than the question needs. For a follow-up question, reuse data already returned earlier in this conversation when it's sufficient, and only call the tool again for genuinely new data (e.g. a different date range, filter, or grouping).

Reply in plain text only — no markdown (no **bold**, no bullet/numbered lists, no headers) — the UI renders your response verbatim.

If the user explicitly asks for a chart, respond with ONLY a fenced \`\`\`chart code block and no prose, containing JSON of the shape {"type":"bar"|"donut"|"pie","categories":[{"label":string,"value":number}]}.`;

const TOOL: Anthropic.Tool = {
  name: "query_report_data",
  description:
    "Query the current report's rows. Returns a compact, aggregated result — never the full dataset. Use groupBy+aggregate for \"how many/total/average per X\" questions; omit groupBy for a small sample of raw rows (use `columns` to keep only the fields you need). Pass `range` only to look at a different date range than the one already in view (e.g. a prior period for comparison).",
  input_schema: {
    type: "object",
    properties: {
      range: {
        type: "object",
        description: "Optional date range override (defaults to the report's current range).",
        properties: {
          from: { type: "string", description: "ISO date, e.g. 2026-08-01" },
          to: { type: "string", description: "ISO date, e.g. 2026-08-31" },
        },
      },
      groupBy: { type: "string", description: "Field key to group and aggregate by, e.g. \"status\" or \"campaign\"." },
      aggregate: { type: "string", enum: ["count", "sum", "avg"], description: "Defaults to \"count\"." },
      aggregateField: { type: "string", description: "Numeric field key to sum/average. Required if aggregate is sum or avg." },
      filters: {
        type: "object",
        description: "Exact-match filters as {fieldKey: value}, applied before aggregating.",
        additionalProperties: { type: "string" },
      },
      columns: {
        type: "array",
        items: { type: "string" },
        description: "Only used without groupBy: which field keys to return per row. Keep this short.",
      },
      limit: { type: "number", description: "Max rows/groups to return (default 20, max 50)." },
      sort: { type: "string", enum: ["asc", "desc"], description: "Sort grouped results by value (default desc)." },
    },
  },
};

interface Turn {
  role: "user" | "assistant";
  text: string;
}

export async function POST(req: NextRequest) {
  const { question, reportKey, from, to, accountId, campaignId, profileId, accountLabel, history, chartContext, chartLabel } = (await req.json()) as {
    question: string;
    reportKey: string;
    from: string;
    to: string;
    accountId?: string;
    campaignId?: string;
    profileId?: string;
    accountLabel?: string;
    history?: Turn[];
    chartContext?: unknown;
    chartLabel?: string;
  };
  if (!question?.trim()) return NextResponse.json({ error: "question is required" }, { status: 400 });
  const definition = getReportDefinition(reportKey);
  if (!definition) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  const def = definition;

  const supabase = createAdminClient();
  const defaultRange: DateRange = { from, to };
  const params = { accountId, campaignId, profileId };

  // Caches fetched report results per distinct range for the lifetime of
  // this one request, so several tool calls against the same range (the
  // common case) don't re-hit the DB.
  const resultCache = new Map<string, ReportResult>();
  async function resultFor(range: DateRange): Promise<ReportResult> {
    const key = `${range.from}:${range.to}`;
    const cached = resultCache.get(key);
    if (cached) return cached;
    const result = await def.fetch(supabase, range, params);
    resultCache.set(key, result);
    return result;
  }

  // Fetch the default range up front — nearly every question needs it,
  // and this also gives us the column list for the tool's field guide
  // below without a separate round-trip.
  const defaultResult = await resultFor(defaultRange);

  const filterBits: string[] = [];
  if (accountLabel) filterBits.push(`Account: ${accountLabel}`);
  const dateFiltered = isDateFilteredReport(reportKey);
  const availableFields = `Available fields: ${defaultResult.columns.map((c) => c.key).join(", ")}`;
  const contextBlock = `Context:
- Report: ${definition.label}${dateFiltered ? `\n- Date: ${from} to ${to}` : " (a point-in-time snapshot, not date-filtered)"}
- Filters: ${filterBits.length ? filterBits.join(", ") : "none"}
- ${availableFields}`;

  // The full Context block (report/date/filters) is only sent on the
  // first turn — a follow-up reuses it from the transcript. Available
  // fields is the exception: it's repeated every turn (cheap, ~15 tokens)
  // because the tool needs exact field keys on every call, and the
  // client only round-trips the plain-text answer between turns, not
  // which keys a prior tool call actually used.
  const isFirstTurn = !history || history.length === 0;
  let userContent = isFirstTurn ? `${contextBlock}\n\nQuestion:\n${question.trim()}` : `${availableFields}\n\nQuestion:\n${question.trim()}`;
  if (chartContext) {
    userContent = `${isFirstTurn ? `${contextBlock}\n\n` : `${availableFields}\n\n`}${chartLabel ? `Chart: ${chartLabel}\n\n` : ""}Data:\n${JSON.stringify(chartContext)}\n\nQuestion:\n${question.trim()}`;
  }

  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map((t) => ({ role: t.role, content: t.text }) as Anthropic.MessageParam),
    { role: "user", content: userContent },
  ];

  const anthropic = getAnthropic();

  for (let iteration = 0; iteration < 4; iteration++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      system: CORE_SYSTEM_PROMPT,
      tools: [TOOL],
      messages,
    });

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (toolUses.length === 0) {
      const answer = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return NextResponse.json({ answer });
    }

    messages.push({ role: "assistant", content: response.content });
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const args = tu.input as QueryArgs & { range?: DateRange };
      const range = args.range?.from && args.range?.to ? args.range : defaultRange;
      const result = await resultFor(range);
      const queried = queryRows(result.rows, args);
      toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(queried) });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return NextResponse.json({ answer: "I couldn't finish that in time — try asking a more specific question." });
}
