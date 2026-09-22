import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_DEFINITIONS } from "@/lib/reports/definitions";
import { ReportBuilder } from "@/components/reports/report-builder";

export const dynamic = "force-dynamic";

// User-level report set — no Account Statistics (org-level) or SRS
// Overview (cross-agent leaderboard); Profile Statistics is included here
// instead of the admin Reports page since it's this one profile's own
// trend, not an admin's.
const USER_REPORT_KEYS = new Set(["campaign_delivery", "campaign_statistics", "survey_results", "profile_statistics"]);

export default async function ViewAsReportsPage({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const supabase = createAdminClient();

  const { data: profile } = await supabase.from("profiles").select("id, name").eq("id", profileId).single();
  if (!profile) notFound();

  const { data: campaigns } = await supabase.from("campaigns").select("id, name").order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl mx-auto px-8 py-7 space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {profile.name}&apos;s reports — export them or ask the analyst what they mean.
      </p>

      <ReportBuilder
        reportOptions={REPORT_DEFINITIONS.filter((r) => USER_REPORT_KEYS.has(r.key)).map((r) => ({
          key: r.key,
          label: r.label,
          description: r.description,
        }))}
        initialExports={[]}
        accounts={[]}
        campaigns={campaigns ?? []}
        profileId={profile.id}
        profileName={profile.name}
      />
    </div>
  );
}
