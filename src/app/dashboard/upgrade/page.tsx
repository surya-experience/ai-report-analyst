import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { UpgradeButton } from "@/components/billing/upgrade-button";
import { BadgeCheck, TrendingUp, BarChart3, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

const BENEFITS = [
  { icon: BadgeCheck, title: "Verified Pro badge", desc: "Shown on your public profile and in search results." },
  { icon: TrendingUp, title: "Boosted search ranking", desc: "Rank higher for relevant searches in your category and region." },
  { icon: BarChart3, title: "Advanced analytics", desc: "See who viewed your profile and what drove contact requests." },
  { icon: Zap, title: "Priority lead routing", desc: "New client inquiries in your area reach you first." },
];

export default async function UpgradePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/upgrade");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("owner_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!profile) redirect("/dashboard");

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-lg px-6 py-12 text-center">
        <p className="text-sm font-semibold text-amber-600 mb-2">Experience.com Pro</p>
        <h1 className="text-3xl font-extrabold tracking-tight mb-2">Get noticed more</h1>
        <p className="text-muted-foreground mb-8">$29/month · cancel anytime</p>

        <div className="grid sm:grid-cols-2 gap-3 text-left mb-8">
          {BENEFITS.map((b) => (
            <Card key={b.title}>
              <CardContent className="pt-2">
                <b.icon className="h-5 w-5 text-indigo-600 mb-2" />
                <p className="font-semibold text-sm">{b.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {profile.status === "pro" ? (
          <p className="text-sm text-emerald-700 font-medium">You&apos;re already on Pro. 🎉</p>
        ) : (
          <UpgradeButton profileId={profile.id} />
        )}
      </main>
    </>
  );
}
