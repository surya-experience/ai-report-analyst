import "server-only";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { SEGMENTS, type SegmentKey } from "@/lib/campaigns/segments";
import type Anthropic from "@anthropic-ai/sdk";

export interface CampaignDraft {
  name: string;
  segment: SegmentKey;
  subject: string;
  body: string;
}

const GENERATE_TOOL: Anthropic.Tool = {
  name: "propose_campaign",
  description: "Propose a structured email campaign for the admin to review.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Internal campaign name." },
      segment: { type: "string", enum: Object.keys(SEGMENTS), description: "Which audience segment to target." },
      subject: { type: "string", description: "Email subject line." },
      body: { type: "string", description: "Plain-text email body, 2-4 short paragraphs, no HTML." },
    },
    required: ["name", "segment", "subject", "body"],
  },
};

const SEGMENT_LIST = Object.entries(SEGMENTS)
  .map(([key, s]) => `- ${key}: ${s.label} — ${s.description}`)
  .join("\n");

export async function generateCampaignDraft(instruction: string): Promise<CampaignDraft> {
  const anthropic = getAnthropic();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 700,
    system: `You are a marketing copywriter for Experience.com, a platform where professionals claim and complete a profile. Given an admin's plain-English request, propose one email campaign using the propose_campaign tool.

Available audience segments:
${SEGMENT_LIST}

Pick the segment that best matches the request. Keep copy honest — never invent stats, testimonials, or guarantees. Tone: warm, direct, no hype.`,
    tools: [GENERATE_TOOL],
    tool_choice: { type: "tool", name: "propose_campaign" },
    messages: [{ role: "user", content: instruction }],
  });

  const call = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!call) throw new Error("The model did not return a campaign proposal.");
  return call.input as CampaignDraft;
}
