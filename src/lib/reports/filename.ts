// Shared by both the export API route (server) and the preview dialog's
// chart-image download (client) — kept dependency-free (no `server-only`,
// no Node APIs) so it can be imported from either side.
//
// Convention: {report_name}_for_{all_accounts_or_account_name}_generated_on_{timestamp}
// or, when the report is date-filtered: .._generated_from_{start}_{end}_{timestamp}
export function buildExportFilename(params: {
  reportLabel: string;
  accountLabel?: string | null;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  extension: string;
  generatedAt?: Date;
}): string {
  const slug = (s: string) =>
    s
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "report";

  const reportSlug = slug(params.reportLabel);
  const accountSlug = slug(params.accountLabel?.trim() || "All Accounts");
  const ts = (params.generatedAt ?? new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);

  const base =
    params.rangeStart && params.rangeEnd
      ? `${reportSlug}_for_${accountSlug}_generated_from_${params.rangeStart}_${params.rangeEnd}_${ts}`
      : `${reportSlug}_for_${accountSlug}_generated_on_${ts}`;

  return `${base}.${params.extension}`;
}

// Duplicated from isDateFilteredReport() in lib/reports/definitions.ts —
// that module is `server-only` and can't be imported from client
// components, so this trivial rule (everything except the point-in-time
// account snapshot) is kept in sync here by hand.
export function isDateFilteredReportKey(reportKey: string): boolean {
  return reportKey !== "account_statistics";
}
