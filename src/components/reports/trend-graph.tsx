"use client";

import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";
import type { SeriesLineDef } from "@/lib/reports/chart-preview";

export function TrendGraph({
  series,
  seriesKeys,
}: {
  series: Record<string, number | string>[];
  seriesKeys: SeriesLineDef[];
}) {
  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No data recorded in this date range.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}>
              <LabelList dataKey={s.key} position="top" style={{ fontSize: 11, fill: s.color }} />
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
