import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveSegmentProfiles, type SegmentKey } from "@/lib/campaigns/segments";
import { sendEmail } from "@/lib/email/send";

// SECURITY: no auth check — see README.md "Admin console has no login".
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  if (campaign.status === "sent") {
    return NextResponse.json({ error: "This campaign has already been sent" }, { status: 409 });
  }

  await supabase.from("campaigns").update({ status: "sending" }).eq("id", id);

  const profiles = await resolveSegmentProfiles(supabase, campaign.segment as SegmentKey);
  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    if (!profile.email) continue;
    const result = await sendEmail({ to: profile.email, subject: campaign.subject, html: campaign.html_body });
    await supabase.from("campaign_sends").insert({
      campaign_id: id,
      profile_id: profile.id,
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
    });
    if (result.ok) {
      sent++;
      await supabase.from("conversion_events").insert({ type: "campaign_sent", profile_id: profile.id, metadata: { campaign_id: id } });
    } else {
      failed++;
    }
  }

  await supabase.from("campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ sent, failed, total: profiles.length });
}
