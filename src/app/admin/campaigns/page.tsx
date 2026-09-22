import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SEGMENTS } from "@/lib/campaigns/segments";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-stone-100 text-stone-600",
  sending: "bg-amber-100 text-amber-700",
  sent: "bg-emerald-100 text-emerald-700",
  scheduled: "bg-indigo-100 text-indigo-700",
  paused: "bg-stone-100 text-stone-600",
};

export default async function CampaignsPage() {
  const supabase = createAdminClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  const campaignIds = campaigns?.map((c) => c.id) ?? [];
  const { data: sends } = campaignIds.length
    ? await supabase.from("campaign_sends").select("campaign_id, status").in("campaign_id", campaignIds)
    : { data: [] as { campaign_id: string; status: string }[] };

  const sendCounts = new Map<string, number>();
  for (const s of sends ?? []) sendCounts.set(s.campaign_id, (sendCounts.get(s.campaign_id) ?? 0) + 1);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-drafted email campaigns by audience segment.</p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">New campaign</Link>
        </Button>
      </div>

      <div className="space-y-2">
        {campaigns?.map((c) => (
          <Link key={c.id} href={`/admin/campaigns/${c.id}`}>
            <Card className="hover:border-indigo-300 transition-colors">
              <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {SEGMENTS[c.segment as keyof typeof SEGMENTS]?.label ?? c.segment} · {sendCounts.get(c.id) ?? 0} sent
                  </p>
                </div>
                <Badge variant="secondary" className={STATUS_STYLE[c.status]}>
                  {c.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
        {!campaigns?.length && (
          <p className="text-sm text-muted-foreground text-center py-10">No campaigns yet.</p>
        )}
      </div>
    </div>
  );
}
