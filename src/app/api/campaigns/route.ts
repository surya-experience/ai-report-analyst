import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { SEGMENTS, type SegmentKey } from "@/lib/campaigns/segments";

export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, segment, subject, body } = (await req.json()) as {
    name: string;
    segment: SegmentKey;
    subject: string;
    body: string;
  };
  if (!name?.trim() || !subject?.trim() || !body?.trim() || !(segment in SEGMENTS)) {
    return NextResponse.json({ error: "name, segment, subject, and body are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const html_body = `<div style="font-family:Arial,sans-serif;max-width:560px;line-height:1.6;">${body
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("")}</div>`;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({ name: name.trim(), segment, subject: subject.trim(), body: body.trim(), html_body, created_by: staff.id })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign });
}
