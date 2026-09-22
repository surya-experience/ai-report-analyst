import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEGMENTS } from "@/lib/campaigns/segments";
import { SendCampaignButton } from "@/components/campaigns/send-campaign-button";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();
  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();

  const { data: sends } = await supabase.from("campaign_sends").select("status").eq("campaign_id", id);
  const counts = { sent: 0, opened: 0, clicked: 0, failed: 0, queued: 0, bounced: 0 };
  for (const s of sends ?? []) counts[s.status as keyof typeof counts]++;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {SEGMENTS[campaign.segment as keyof typeof SEGMENTS]?.label ?? campaign.segment}
          </p>
        </div>
        <Badge variant="secondary">{campaign.status}</Badge>
      </div>

      {campaign.status === "sent" ? (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sent" value={counts.sent} />
          <Stat label="Opened" value={counts.opened} />
          <Stat label="Clicked" value={counts.clicked} />
        </div>
      ) : (
        <SendCampaignButton campaignId={campaign.id} />
      )}

      <Card>
        <CardContent className="pt-2 space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Subject</p>
            <p className="text-sm font-medium">{campaign.subject}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Body</p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{campaign.body}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <p className="text-2xl font-extrabold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
