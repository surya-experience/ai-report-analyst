import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// SECURITY: no auth check — see README.md "Admin console has no login".
// sender_id is left null since there's no admin identity to attach.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { message } = (await req.json()) as { message: string };
  if (!message?.trim()) return NextResponse.json({ error: "message is required" }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from("support_messages").insert({
    conversation_id: id,
    sender_type: "agent",
    body: message.trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("support_conversations").update({ status: "open", channel: "human" }).eq("id", id);

  return NextResponse.json({ ok: true });
}
