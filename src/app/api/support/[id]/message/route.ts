import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropic, CLAUDE_MODEL } from "@/lib/ai/anthropic";
import { SUPPORT_AI_SYSTEM_PROMPT } from "@/lib/ai/support";
import type Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const { data: convo } = await supabase.from("support_conversations").select("*").eq("id", id).single();
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  const isStaff = roleRow?.role === "admin" || roleRow?.role === "support";
  const isRequester = convo.requester_id === user.id;
  if (!isStaff && !isRequester) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const senderType = isStaff && !isRequester ? "agent" : "member";
  const { error: msgError } = await supabase.from("support_messages").insert({
    conversation_id: id,
    sender_type: senderType,
    sender_id: user.id,
    body: message.trim(),
  });
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // Only auto-reply with the AI while the ticket is still on the AI
  // channel and the message came from the member — once a human has
  // taken over (channel === 'human'), the AI stays quiet.
  if (convo.channel === "ai" && senderType === "member") {
    const { data: history } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    try {
      const anthropic = getAnthropic();
      const response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 400,
        system: SUPPORT_AI_SYSTEM_PROMPT,
        messages: (history ?? [])
          .filter((m) => m.sender_type !== "agent")
          .map((m) => ({
            role: m.sender_type === "ai" ? ("assistant" as const) : ("user" as const),
            content: m.body,
          })),
      });
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (text) {
        await supabase.from("support_messages").insert({ conversation_id: id, sender_type: "ai", body: text });
      }
    } catch {
      // best-effort, as above
    }
  }

  await supabase.from("support_conversations").update({ status: "open" }).eq("id", id);

  return NextResponse.json({ ok: true });
}
