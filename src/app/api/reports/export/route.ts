import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReportDefinition } from "@/lib/reports/definitions";
import { buildReportFile, type ExportFormat } from "@/lib/reports/export";

// SECURITY: no auth check — see README.md "Admin console has no login".
// requested_by_label is a free-text display name since there's no admin
// identity to attribute the export to; it defaults to "Admin".
export async function POST(req: NextRequest) {
  const { reportKey, format, from, to, requestedByLabel, accountId } = (await req.json()) as {
    reportKey: string;
    format: ExportFormat;
    from: string;
    to: string;
    requestedByLabel?: string;
    accountId?: string;
  };
  const definition = getReportDefinition(reportKey);
  if (!definition) return NextResponse.json({ error: "Unknown report" }, { status: 400 });
  if (!["xlsx", "csv", "pdf"].includes(format)) {
    return NextResponse.json({ error: "Unknown format" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const result = await definition.fetch(supabase, { from, to }, { accountId });
  const file = await buildReportFile(format, definition.label, result.summaryLabel, result.rows, result.columns);

  const storagePath = `${reportKey}/${Date.now()}-${crypto.randomUUID()}.${file.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("report-exports")
    .upload(storagePath, file.buffer, { contentType: file.contentType });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: exportRow, error: insertError } = await supabase
    .from("report_exports")
    .insert({
      report_key: reportKey,
      report_label: definition.label,
      format,
      range_start: from,
      range_end: to,
      row_count: result.rows.length,
      file_size_bytes: file.buffer.byteLength,
      storage_path: storagePath,
      requested_by_label: requestedByLabel?.trim() || "Admin",
    })
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: signed } = await supabase.storage.from("report-exports").createSignedUrl(storagePath, 60);

  return NextResponse.json({ export: exportRow, url: signed?.signedUrl });
}
