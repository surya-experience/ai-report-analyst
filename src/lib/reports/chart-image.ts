// Renders preview charts to a PNG for download, straight from the same data
// the on-screen chart uses (rather than rasterizing the DOM/SVG) — this
// keeps rendering consistent across chart types, including the "Bar" view,
// which is plain HTML/CSS in the UI and has no <svg> to capture.
import type { ChartCategory, SeriesLineDef } from "@/lib/reports/chart-preview";

const COLORS = ["#4C5FDB", "#7C3AED", "#F5821F", "#16A34A", "#0EA5E9"];
const INK = "#1B2559";
const MUTED = "#6B7280";

export type ChartRegion =
  | { type: "bar"; categories: ChartCategory[] }
  | { type: "pie"; categories: ChartCategory[]; donut: boolean }
  | { type: "line"; series: Record<string, number | string>[]; seriesKeys: SeriesLineDef[] };

function drawBar(ctx: CanvasRenderingContext2D, region: Extract<ChartRegion, { type: "bar" }>, x: number, y: number, w: number, h: number) {
  const categories = region.categories;
  if (categories.length === 0) return;
  const max = Math.max(1, ...categories.map((c) => c.value));
  const rowH = h / categories.length;
  categories.forEach((c, i) => {
    const rowY = y + i * rowH;
    ctx.fillStyle = INK;
    ctx.font = "600 12px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(c.label, x, rowY + 12);
    ctx.fillStyle = MUTED;
    ctx.textAlign = "right";
    ctx.fillText(String(c.value), x + w, rowY + 12);
    ctx.textAlign = "left";
    const barY = rowY + 18;
    const barH = 8;
    ctx.fillStyle = "#EEF0F7";
    roundRect(ctx, x, barY, w, barH, 4);
    ctx.fill();
    ctx.fillStyle = "#4C5FDB";
    roundRect(ctx, x, barY, Math.max(4, (c.value / max) * w), barH, 4);
    ctx.fill();
  });
}

function drawPie(ctx: CanvasRenderingContext2D, region: Extract<ChartRegion, { type: "pie" }>, x: number, y: number, w: number, h: number) {
  const categories = region.categories.filter((c) => c.value > 0);
  const total = categories.reduce((s, c) => s + c.value, 0);
  if (total === 0) return;
  const legendH = 18 * Math.ceil(categories.length / 2);
  const chartH = h - legendH;
  const cx = x + w / 2;
  const cy = y + chartH / 2;
  const radius = Math.min(w, chartH) / 2 - 8;
  const innerRadius = region.donut ? radius * 0.55 : 0;
  let angle = -Math.PI / 2;
  categories.forEach((c, i) => {
    const slice = (c.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fill();
    angle += slice;
  });
  if (innerRadius > 0) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  // Legend
  ctx.font = "12px Inter, sans-serif";
  categories.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = x + col * (w / 2);
    const ly = y + chartH + row * 18 + 12;
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(lx, ly - 8, 8, 8);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(`${c.label} (${c.value})`, lx + 12, ly);
  });
}

function drawLine(ctx: CanvasRenderingContext2D, region: Extract<ChartRegion, { type: "line" }>, x: number, y: number, w: number, h: number) {
  const { series, seriesKeys } = region;
  if (series.length === 0) return;
  const legendY = y + h - 14;
  const chartH = h - 24;
  const max = Math.max(
    1,
    ...series.flatMap((row) => seriesKeys.map((s) => Number(row[s.key]) || 0))
  );
  const stepX = series.length > 1 ? w / (series.length - 1) : 0;

  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + chartH);
  ctx.lineTo(x + w, y + chartH);
  ctx.stroke();

  seriesKeys.forEach((s) => {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    series.forEach((row, i) => {
      const px = x + i * stepX;
      const py = y + chartH - ((Number(row[s.key]) || 0) / max) * chartH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  ctx.font = "12px Inter, sans-serif";
  let lx = x;
  seriesKeys.forEach((s) => {
    ctx.fillStyle = s.color;
    ctx.fillRect(lx, legendY - 8, 8, 8);
    ctx.fillStyle = INK;
    ctx.textAlign = "left";
    ctx.fillText(s.label, lx + 12, legendY);
    lx += ctx.measureText(s.label).width + 32;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawRegion(ctx: CanvasRenderingContext2D, region: ChartRegion, x: number, y: number, w: number, h: number) {
  if (region.type === "bar") drawBar(ctx, region, x, y, w, h);
  else if (region.type === "pie") drawPie(ctx, region, x, y, w, h);
  else drawLine(ctx, region, x, y, w, h);
}

export function downloadChartsAsPng(
  filename: string,
  title: string,
  cells: { label: string; region: ChartRegion }[]
) {
  const cols = cells.length > 1 ? 2 : 1;
  const rows = Math.ceil(cells.length / cols);
  const cellW = 420;
  const cellH = 260;
  const pad = 20;
  const titleH = 36;

  const width = pad + cols * (cellW + pad);
  const height = titleH + pad + rows * (cellH + pad);

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = INK;
  ctx.font = "700 16px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(title, pad, 26);

  cells.forEach((cell, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (cellW + pad);
    const y = titleH + pad + row * (cellH + pad);
    ctx.strokeStyle = "#E5E7EB";
    ctx.strokeRect(x, y, cellW, cellH);
    ctx.fillStyle = INK;
    ctx.font = "600 13px Inter, sans-serif";
    ctx.fillText(cell.label, x + 14, y + 22);
    drawRegion(ctx, cell.region, x + 14, y + 36, cellW - 28, cellH - 50);
  });

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}
