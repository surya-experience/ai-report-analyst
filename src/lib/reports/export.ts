import "server-only";
import * as XLSX from "xlsx";
import type { ReportColumn } from "@/lib/reports/definitions";

export type ExportFormat = "xlsx" | "csv";

// xlsx here only ever WRITES data we generated ourselves (never parses an
// uploaded/untrusted file), which is the one usage pattern the package's
// known advisories (prototype pollution / ReDoS, both in the parser) don't
// touch — see README "Reports" for the tradeoff.
export function buildXlsx(rows: Record<string, string | number>[], columns: ReportColumn[]): Buffer {
  const sheetRows = rows.map((row) => {
    const ordered: Record<string, string | number> = {};
    for (const col of columns) ordered[col.label] = row[col.key] ?? "";
    return ordered;
  });
  const sheet = XLSX.utils.json_to_sheet(sheetRows, { header: columns.map((c) => c.label) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Report");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function csvEscape(value: string | number): string {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(rows: Record<string, string | number>[], columns: ReportColumn[]): Buffer {
  const lines = [
    columns.map((c) => csvEscape(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => csvEscape(row[c.key] ?? "")).join(",")),
  ];
  return Buffer.from(lines.join("\n"), "utf-8");
}

export function buildReportFile(
  format: ExportFormat,
  rows: Record<string, string | number>[],
  columns: ReportColumn[]
): { buffer: Buffer; contentType: string; extension: string } {
  if (format === "xlsx") {
    return {
      buffer: buildXlsx(rows, columns),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  return { buffer: buildCsv(rows, columns), contentType: "text/csv", extension: "csv" };
}
