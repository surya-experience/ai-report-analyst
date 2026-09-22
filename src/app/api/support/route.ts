import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { SUPPORT_AI_SYSTEM_PROMPT } from "@/lib/ai/support";
import type Anthropic from "@anthropic-ai/sdk";

// Opens a new support conversation with the member's first message, and (for
// the default AI channel) generates the assistant's first reply immediately
// so the member isn't left staring at an empty thread.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { subject, message, profileId } = (await req.json()) as {
    subject: string;
    message: string;
    profileId?: string;
  };
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "subject and message are required" }, { status: 400 });
  }

  const { data: convo, error: convoError } = await supabase
    .from("support_conversations")
    .insert({ subject: subject.trim(), requester_id: user.id, profile_id: profileId ?? null })
    .select("*")
    .single();
  if (convoError || !convo) {
    return NextResponse.json({ error: convoError?.message ?? "Could not open ticket" }, { status: 500 });
  }

  const { error: msgError } = await supabase.from("support_messages").insert({
    conversation_id: convo.id,
    sender_type: "member",
    sender_id: user.id,
    body: message.trim(),
  });
  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      system: SUPPORT_AI_SYSTEM_PROMPT,
      messages: [{ role: "user", content: message.trim() }],
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (text) {
      await supabase.from("support_messages").insert({
        conversation_id: convo.id,
        sender_type: "ai",
        body: text,
      });
    }
  } catch {
    // AI reply is best-effort — the member still has their ticket and a
    // human can pick it up even if the model call failed.
  }

  return NextResponse.json({ conversation: convo });
}
