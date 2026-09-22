import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SupportConversation } from "@/types/database";

// Member and staff both call this to change conversation state: a member
// can only request human handoff on their own ticket; staff can assign
// themselves and change status. RLS still enforces the underlying row
// access — this route just picks which fields are allowed for which actor.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { data: convo } = await supabase.from("support_conversations").select("*").eq("id", id).single();
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  const isStaff = roleRow?.role === "admin" || roleRow?.role === "support";
  const isRequester = convo.requester_id === user.id;
  if (!isStaff && !isRequester) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { action: "request_human" | "assign_to_me" | "resolve" | "reopen" };
  let patch: Partial<SupportConversation> = {};

  if (body.action === "request_human") {
    if (!isRequester) return NextResponse.json({ error: "Only the requester can ask for a human" }, { status: 403 });
    patch = { channel: "human", status: "pending" };
    await supabase.from("support_messages").insert({
      conversation_id: id,
      sender_type: "member",
      sender_id: user.id,
      body: "Requested a human agent.",
    });
  } else if (body.action === "assign_to_me") {
    if (!isStaff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
    patch = { assigned_to: user.id, status: "open", channel: "human" };
  } else if (body.action === "resolve") {
    if (!isStaff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
    patch = { status: "resolved" };
  } else if (body.action === "reopen") {
    if (!isStaff) return NextResponse.json({ error: "Staff only" }, { status: 403 });
    patch = { status: "open" };
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("support_conversations")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ conversation: updated });
}
