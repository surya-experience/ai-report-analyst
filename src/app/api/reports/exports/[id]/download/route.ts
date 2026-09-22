import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildExportFilename } from "@/lib/reports/filename";

// SECURITY: no auth check — see README.md "Admin console has no login".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("report_exports")
    .select("storage_path, report_label, format, range_start, range_end, account_label, created_at")
    .eq("id", id)
    .single();
  if (!row) return NextResponse.json({ error: "Export not found" }, { status: 404 });

  const downloadFilename = buildExportFilename({
    reportLabel: row.report_label,
    accountLabel: row.account_label,
    rangeStart: row.range_start,
    rangeEnd: row.range_end,
    extension: row.format,
    generatedAt: new Date(row.created_at),
  });

  const { data: signed, error } = await supabase.storage
    .from("report-exports")
    .createSignedUrl(row.storage_path, 60, { download: downloadFilename });
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
