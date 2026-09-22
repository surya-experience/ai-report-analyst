import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_DEFINITIONS } from "@/lib/reports/definitions";
import { ReportBuilder } from "@/components/reports/report-builder";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createAdminClient();
  const [{ data: exports }, { data: accounts }, { data: campaigns }] = await Promise.all([
    supabase.from("report_exports").select("*").order("created_at", { ascending: false }).limit(20),
    supabase.from("accounts").select("id, account_name, organization_name").order("account_name", { ascending: true }),
    supabase.from("campaigns").select("id, name").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-6xl space-y-2">
      <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Build a report from your account data, then export it or ask the analyst what it means.
      </p>

      <ReportBuilder
        reportOptions={REPORT_DEFINITIONS.filter((r) => r.key !== "profile_statistics").map((r) => ({
          key: r.key,
          label: r.label,
          description: r.description,
        }))}
        initialExports={exports ?? []}
        accounts={accounts ?? []}
        campaigns={campaigns ?? []}
      />
    </div>
  );
}
