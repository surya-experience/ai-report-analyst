import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEGMENTS, type SegmentKey } from "@/lib/campaigns/segments";

// SECURITY: no auth check — the admin console has no login by design
// (see README.md). This route is reachable by anyone who can reach the
// server; don't add it back to a page that isn't already unauthenticated.
export async function POST(req: NextRequest) {
  const { name, segment, subject, body } = (await req.json()) as {
    name: string;
    segment: SegmentKey;
    subject: string;
    body: string;
  };
  if (!name?.trim() || !subject?.trim() || !body?.trim() || !(segment in SEGMENTS)) {
    return NextResponse.json({ error: "name, segment, subject, and body are required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const html_body = `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6;">${body
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ name: name.trim(), segment, subject: subject.trim(), body: body.trim(), html_body, created_by: null })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign });
}
