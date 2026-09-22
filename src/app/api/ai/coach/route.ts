import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { applyFieldPatch, completenessOf, FIELD_DEFS, missingFields } from "@/lib/profile-fields";
import type { AiMessage, Profile } from "@/types/database";
import type Anthropic from "@anthropic-ai/sdk";

const UPDATE_TOOL: Anthropic.Tool = {
  name: "update_profile_field",
  description:
    "Save a value the user just gave you onto their profile. Call this as soon as you have a clean value for a field — don't wait until the end of the conversation.",
  input_schema: {
    type: "object",
    properties: {
      field: {
        type: "string",
        enum: FIELD_DEFS.map((f) => f.key),
        description: "Which profile field this value belongs to.",
      },
      value: {
        description:
          "The value to save. Use a string for text fields, an array of strings for list fields (skills, services, licence), and true/false for the photo field.",
      },
    },
    required: ["field", "value"],
  },
};

function buildSystemPrompt(profile: Profile) {
  const missing = missingFields(profile).map((f) => f.label);
  const completeness = completenessOf(profile);
  return `You are the Experience.com AI Profile Coach, helping ${profile.name} (a ${profile.profession}) complete their professional profile through natural conversation.

Current profile completeness: ${completeness}%.
Fields still missing: ${missing.length ? missing.join(", ") : "none — profile is complete"}.

Rules:
- Ask about ONE missing field at a time, in a friendly, conversational tone. Briefly explain why it matters if helpful.
- The moment the user gives you a usable answer, call update_profile_field to save it — don't just acknowledge it in text.
- If the user says something like "no", "none", or "skip", do not save a value — acknowledge and move to the next field.
- For list fields (skills, services, licence), accept a comma-separated answer and save it as an array.
- Never invent or assume information the user hasn't told you.
- Keep responses short (1-3 sentences) plus, when relevant, the next question.
- When every field is filled, congratulate them and mention their profile is complete.`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { profileId, message } = (await req.json()) as { profileId: string; message: string };
  if (!profileId || !message?.trim()) {
    return NextResponse.json({ error: "profileId and message are required" }, { status: 400 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .single();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }
  if (profile.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let { data: convo } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("profile_id", profileId)
    .eq("kind", "coach")
    .eq("status", "active")
    .maybeSingle();

  if (!convo) {
    const { data: created, error: createError } = await supabase
      .from("ai_conversations")
      .insert({ profile_id: profileId, kind: "coach", messages: [] })
      .select("*")
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? "Could not start conversation" }, { status: 500 });
    }
    convo = created;
  }

  const history: AiMessage[] = convo.messages ?? [];
  const anthropicMessages: Anthropic.MessageParam[] = history
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
  anthropicMessages.push({ role: "user", content: message });

  const anthropic = getAnthropic();
  let workingProfile: Profile = profile;
  const updatedFields: string[] = [];

  let response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    system: buildSystemPrompt(workingProfile),
    tools: [UPDATE_TOOL],
    messages: anthropicMessages,
  });

  // Tool-use loop: apply each update_profile_field call against the DB,
  // then hand the result back to the model so it can keep going (e.g. ask
  // the next question) in the same turn.
  let guard = 0;
  while (response.stop_reason === "tool_use" && guard < 5) {
    guard++;
    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const call of toolUses) {
      const input = call.input as { field: string; value: unknown };
      const patch = applyFieldPatch(workingProfile, input.field, input.value);
      if (Object.keys(patch).length > 0) {
        const { data: saved, error: saveError } = await supabase
          .from("profiles")
          .update(patch)
          .eq("id", profileId)
          .select("*")
          .single();
        if (saved) {
          workingProfile = saved;
          updatedFields.push(input.field);
        }
        toolResults.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: saveError ? `Failed to save: ${saveError.message}` : "Saved.",
        });
      } else {
        toolResults.push({ type: "tool_result", tool_use_id: call.id, content: "Unknown field, not saved." });
      }
    }

    anthropicMessages.push({ role: "assistant", content: response.content });
    anthropicMessages.push({ role: "user", content: toolResults });

    response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 600,
      system: buildSystemPrompt(workingProfile),
      tools: [UPDATE_TOOL],
      messages: anthropicMessages,
    });
  }

  const assistantText = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  const newMessages: AiMessage[] = [
    ...history,
    { role: "user", text: message, ts: new Date().toISOString() },
    { role: "assistant", text: assistantText, ts: new Date().toISOString() },
  ];

  const stillMissing = missingFields(workingProfile);
  await supabase
    .from("ai_conversations")
    .update({
      messages: newMessages,
      status: stillMissing.length === 0 ? "completed" : "active",
    })
    .eq("id", convo.id);

  return NextResponse.json({
    reply: assistantText,
    profile: workingProfile,
    updatedFields,
    completeness: completenessOf(workingProfile),
  });
}
