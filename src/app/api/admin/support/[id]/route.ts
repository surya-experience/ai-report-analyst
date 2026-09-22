import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupportConversation } from "@/types/database";

// SECURITY: no auth check — see README.md "Admin console has no login".
// Unlike src/app/api/support/[id]/route.ts (the member-facing version,
// which still requires a signed-in requester), this is the admin-side
// equivalent and always writes through the service-role client since
// there's no admin session for RLS to check.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: convo } = await supabase.from("support_conversations").select("*").eq("id", id).single();
  if (!convo) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

  const body = (await req.json()) as { action: "take" | "resolve" | "reopen" };
  let patch: Partial<SupportConversation> = {};

  if (body.action === "take") {
    patch = { status: "open", channel: "human" };
  } else if (body.action === "resolve") {
    patch = { status: "resolved" };
  } else if (body.action === "reopen") {
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
