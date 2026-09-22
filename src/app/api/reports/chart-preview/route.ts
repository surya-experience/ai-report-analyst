import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportDefinition } from "@/lib/reports/definitions";
import { buildChartPreview } from "@/lib/reports/chart-preview";

// SECURITY: no auth check — see README.md "Admin console has no login".
export async function POST(req: NextRequest) {
  const { reportKey, from, to, accountId } = (await req.json()) as {
    reportKey: string;
    from: string;
    to: string;
    accountId?: string;
  };
  const definition = getReportDefinition(reportKey);
  if (!definition) return NextResponse.json({ error: "Unknown report" }, { status: 400 });

  const supabase = createAdminClient();
  const preview = await buildChartPreview(supabase, reportKey, { from, to }, { accountId });
  return NextResponse.json({ preview });
}
