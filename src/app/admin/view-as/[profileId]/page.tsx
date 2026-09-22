import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/view-as/score-gauge";
import { completenessOf, missingFields } from "@/lib/profile-fields";
import { Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ViewAsDashboardPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).single();
  if (!profile) notFound();

  const { data: statRows } = await supabase
    .from("profile_daily_stats")
    .select("*")
    .eq("profile_id", profileId)
    .order("stat_date", { ascending: false })
    .limit(1);
  const latestStat = statRows?.[0] ?? null;
  const score = latestStat
    ? latestStat.profile_completion_points +
      latestStat.review_reply_points +
      latestStat.connections_points +
      latestStat.listings_points +
      latestStat.web_analytics_points
    : 0;

  // Peer rank — every other profile in the same profession, ranked by
  // each one's own latest score, same as the SRS leaderboard math
  // elsewhere in this app (lib/reports/chart-preview.ts's
  // buildAgentOverview) — just scoped to "peers of this one profile"
  // instead of "every agent".
  const { data: peers } = await supabase.from("profiles").select("id, profession, location").eq("profession", profile.profession);
  const { data: allStats } = await supabase
    .from("profile_daily_stats")
    .select("profile_id, stat_date, profile_completion_points, review_reply_points, connections_points, listings_points, web_analytics_points")
    .order("stat_date", { ascending: false })
    .limit(5000);
  const latestByProfile = new Map<string, NonNullable<typeof allStats>[number]>();
  for (const r of allStats ?? []) {
    if (!latestByProfile.has(r.profile_id)) latestByProfile.set(r.profile_id, r);
  }
  const peerScores = (peers ?? [])
    .map((p) => {
      const s = latestByProfile.get(p.id);
      const total = s
        ? s.profile_completion_points + s.review_reply_points + s.connections_points + s.listings_points + s.web_analytics_points
        : 0;
      return { id: p.id, total };
    })
    .sort((a, b) => b.total - a.total);
  const rank = peerScores.findIndex((p) => p.id === profileId) + 1;
  const peerCount = Math.max(0, peerScores.length - 1);

  const { data: reviews } = await supabase.from("survey_responses").select("rating").eq("profile_id", profileId);
  const reviewCount = reviews?.length ?? 0;
  const avgRating = reviewCount ? (reviews!.reduce((sum, r) => sum + r.rating, 0) / reviewCount).toFixed(1) : "—";

  // This is a Server Component — it runs once per request on the server,
  // not a client render the purity rule needs to guard, so "now" here is
  // intentional and safe.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: sendsCount } = await supabase
    .from("campaign_sends")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("created_at", thirtyDaysAgo);

  const completeness = completenessOf(profile);
  const missing = missingFields(profile);

  return (
    <div className="mx-auto w-full max-w-5xl px-8 py-7 space-y-6">
      {completeness < 100 && (
        <div className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white px-5 py-3.5 flex items-center gap-3">
          <Sparkles className="h-4 w-4 shrink-0" />
          <p className="text-sm font-semibold">Complete your profile to boost your search rank</p>
        </div>
      )}

      <Card className="border-indigo-200 bg-indigo-50/40">
        <CardContent className="pt-2">
          <p className="text-xs font-bold text-indigo-700 mb-2">✨ ASK AI</p>
          <div className="rounded-md border bg-background px-3.5 py-2.5 text-sm text-muted-foreground">
            e.g. I want to update my company, or How do I get verified?
          </div>
          <p className="text-xs text-muted-foreground mt-2">Admin preview — AI Coach isn&apos;t interactive from here.</p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">
        <Card>
          <CardContent className="pt-2 text-center space-y-3">
            <div className="h-14 w-14 rounded-full bg-muted mx-auto flex items-center justify-center font-bold text-lg">
              {profile.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-bold">{profile.name}</p>
              {rank > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  You&apos;re ranked <span className="font-semibold text-foreground">{rank}</span> of {peerCount} other{" "}
                  {profile.profession}s in {profile.location}
                </p>
              )}
            </div>
            <Button variant="outline" size="sm" asChild className="w-full">
              <Link href={`/p/${profile.id}`}>View public profile</Link>
            </Button>
            <div className="flex justify-center pt-1">
              <ScoreGauge score={score} max={300} />
            </div>
            <p className="text-xs text-muted-foreground -mt-2">Search Rank Score</p>
            <Button size="sm" disabled title="Admin preview — not editable" className="w-full">
              Update with AI Coach
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {profile.status !== "pro" && (
            <Card className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white border-0">
              <CardContent className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold">Stand out with a Pro profile</p>
                  <p className="text-sm text-indigo-100 mt-0.5">
                    A verified badge, boosted search ranking, and visitor analytics — see who is checking out your profile.
                  </p>
                </div>
                <Button size="sm" variant="secondary" disabled title="Admin preview — not editable">
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-2 space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold">
                  Profile Score Overview{" "}
                  <Badge variant="secondary" className="ml-1 align-middle">
                    {profile.status}
                  </Badge>
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{score}</span> points
                </p>
              </div>

              <ScoreBar stat={latestStat} />

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <LegendDot color="#16A34A" label="Reviews & Replies" />
                <LegendDot color="#4C5FDB" label="Profile Completion" />
                <LegendDot color="#0D9488" label="Client Connections" />
                <LegendDot color="#F59E0B" label="Listings" />
                <LegendDot color="#EA580C" label="Web Analytics" />
              </div>

              {missing.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: filling in {missing[0].label.toLowerCase()} can raise your Profile Completion score.
                </p>
              )}

              <div className="grid sm:grid-cols-3 gap-3">
                <StatTile label="Reviews & Replies" value={`${reviewCount} review${reviewCount === 1 ? "" : "s"}`} sub={reviewCount ? `${avgRating}★ average` : undefined} />
                <StatTile label="Profile Completion" value={`${completeness}%`} sub={`${missing.length} incomplete item${missing.length === 1 ? "" : "s"}`} />
                <StatTile label="Campaign Sends (30d)" value={String(sendsCount ?? 0)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ScoreBar({
  stat,
}: {
  stat: {
    review_reply_points: number;
    profile_completion_points: number;
    connections_points: number;
    listings_points: number;
    web_analytics_points: number;
  } | null;
}) {
  const segments = stat
    ? [
        { value: stat.review_reply_points, color: "#16A34A" },
        { value: stat.profile_completion_points, color: "#4C5FDB" },
        { value: stat.connections_points, color: "#0D9488" },
        { value: stat.listings_points, color: "#F59E0B" },
        { value: stat.web_analytics_points, color: "#EA580C" },
      ]
    : [];
  // Widths are each category's share of this profile's own total, not a
  // fraction of 100 — Search Rank Score is open-ended (routinely 100-250+
  // for active profiles), so a fixed 100-point scale would overflow the
  // bar for anyone above it.
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="h-2.5 rounded-full bg-muted overflow-hidden flex">
      {segments.map((s, i) => (
        <div key={i} style={{ width: total ? `${(s.value / total) * 100}%` : 0, backgroundColor: s.color }} />
      ))}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3.5 py-3">
      <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
      <p className="font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
