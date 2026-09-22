"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ChartCategory } from "@/lib/reports/chart-preview";

const COLORS = ["#4C5FDB", "#7C3AED", "#F5821F", "#16A34A", "#0EA5E9"];

export function CategoryBars({ categories }: { categories: ChartCategory[] }) {
  const max = Math.max(1, ...categories.map((c) => c.value));
  return (
    <div className="space-y-4">
      {categories.map((c) => (
        <div key={c.label}>
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-sm font-semibold">{c.label}</span>
            <span className="text-sm text-muted-foreground">{c.value}</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-600"
              style={{ width: `${(c.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
      {categories.every((c) => c.value === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">No data in this date range.</p>
      )}
    </div>
  );
}

export function CategoryPie({ categories, donut }: { categories: ChartCategory[]; donut: boolean }) {
  const nonZero = categories.filter((c) => c.value > 0);
  if (nonZero.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No data in this date range.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={categories}
            dataKey="value"
            nameKey="label"
            innerRadius={donut ? 55 : 0}
            outerRadius={90}
            paddingAngle={2}
          >
            {categories.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend verticalAlign="bottom" height={24} iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
