import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { FunnelChart } from "@/components/admin/funnel-chart";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const supabase = createAdminClient();

  const [{ count: total }, { count: unclaimed }, { count: claimed }, { count: pro }, { data: events }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "unclaimed"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "claimed"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("status", "pro"),
      supabase.from("conversion_events").select("type, ts").order("ts", { ascending: false }).limit(2000),
    ]);

  const counts = { claim_started: 0, claim_completed: 0, upgrade_page_viewed: 0, subscription_activated: 0 };
  for (const e of events ?? []) {
    if (e.type in counts) counts[e.type as keyof typeof counts]++;
  }

  const stats = [
    { label: "Total profiles", value: total ?? 0 },
    { label: "Unclaimed", value: unclaimed ?? 0 },
    { label: "Claimed", value: claimed ?? 0 },
    { label: "Pro", value: pro ?? 0 },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">Platform-wide profile and conversion stats.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="py-4">
              <p className="text-2xl font-extrabold">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-2">
          <h2 className="text-sm font-semibold mb-4">Conversion funnel (last 2,000 events)</h2>
          <FunnelChart counts={counts} />
        </CardContent>
      </Card>
    </div>
  );
}
