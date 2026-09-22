import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { completenessOf, missingFields } from "@/lib/profile-fields";
import { Sparkles, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("owner_id", user.id)
    .order("last_activity_at", { ascending: false });

  const profile = profiles?.[0];

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-3xl px-6 py-10">
        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Your dashboard</h1>
          <Link href="/dashboard/support" className="text-sm font-medium text-indigo-600 hover:underline">
            Need help? Contact support
          </Link>
        </div>
        <p className="text-muted-foreground text-sm mb-8">Signed in as {user.email}</p>

        {!profile ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="font-medium mb-1">No profile claimed yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Search the directory to find and claim your professional profile.
              </p>
              <Button asChild>
                <Link href="/">Search the directory</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-2">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-lg">{profile.name}</p>
                      <Badge
                        variant="secondary"
                        className={
                          profile.status === "pro"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }
                      >
                        {profile.status === "pro" ? "Pro" : "Claimed"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {profile.profession}
                      {profile.org ? ` · ${profile.org}` : ""}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/p/${profile.id}`}>View public profile</Link>
                  </Button>
                </div>

                <div className="mt-5">
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">Profile completeness</span>
                    <span className="font-semibold">{completenessOf(profile)}%</span>
                  </div>
                  <Progress value={completenessOf(profile)} />
                </div>
              </CardContent>
            </Card>

            {missingFields(profile).length > 0 && (
              <Card className="border-indigo-200 bg-indigo-50/40">
                <CardContent className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-sm">Finish your profile with the AI Coach</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {missingFields(profile).length} field
                        {missingFields(profile).length === 1 ? "" : "s"} left — a quick chat fills
                        them in.
                      </p>
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href="/dashboard/coach">
                      Open AI Coach <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {profile.status !== "pro" && (
              <Card>
                <CardContent className="pt-2 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm">Upgrade to Pro</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Verified badge, boosted ranking, and visitor analytics.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/dashboard/upgrade">See Pro benefits</Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </>
  );
}
