import "server-only";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import type { ReportColumn } from "@/lib/reports/definitions";

export type ExportFormat = "xlsx" | "csv" | "pdf";

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

export function buildPdf(
  title: string,
  summaryLabel: string,
  rows: Record<string, string | number>[],
  columns: ReportColumn[]
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A4", layout: "landscape" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(16).text(title, { align: "left" });
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor("#666").text(summaryLabel);
    doc.moveDown(1);

    const startX = doc.x;
    const colWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right) / columns.length;
    let y = doc.y;

    doc.fontSize(9).fillColor("#000");
    columns.forEach((col, i) => {
      doc.text(col.label, startX + i * colWidth, y, { width: colWidth - 6, ellipsis: true });
    });
    y += 16;
    doc.moveTo(startX, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor("#ccc").stroke();
    y += 6;

    for (const row of rows.slice(0, 500)) {
      if (y > doc.page.height - doc.page.margins.bottom - 20) {
        doc.addPage({ margin: 36, size: "A4", layout: "landscape" });
        y = doc.page.margins.top;
      }
      columns.forEach((col, i) => {
        doc
          .fontSize(8)
          .fillColor("#222")
          .text(String(row[col.key] ?? ""), startX + i * colWidth, y, { width: colWidth - 6, ellipsis: true });
      });
      y += 14;
    }

    if (rows.length > 500) {
      doc.moveDown(1).fontSize(8).fillColor("#888").text(`… and ${rows.length - 500} more rows (see XLSX/CSV export for the full set).`);
    }

    doc.end();
  });
}

export async function buildReportFile(
  format: ExportFormat,
  title: string,
  summaryLabel: string,
  rows: Record<string, string | number>[],
  columns: ReportColumn[]
): Promise<{ buffer: Buffer; contentType: string; extension: string }> {
  if (format === "xlsx") {
    return {
      buffer: buildXlsx(rows, columns),
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  }
  if (format === "csv") {
    return { buffer: buildCsv(rows, columns), contentType: "text/csv", extension: "csv" };
  }
  return { buffer: await buildPdf(title, summaryLabel, rows, columns), contentType: "application/pdf", extension: "pdf" };
}
