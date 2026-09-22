"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

const STAGE_LABELS: Record<string, string> = {
  claim_started: "Claim started",
  claim_completed: "Claim completed",
  upgrade_page_viewed: "Viewed upgrade",
  subscription_activated: "Subscribed",
};
const COLORS = ["#4C5FDB", "#7C3AED", "#F5821F", "#16A34A"];

export function FunnelChart({ counts }: { counts: Record<string, number> }) {
  const data = Object.entries(STAGE_LABELS).map(([key, label]) => ({
    label,
    value: counts[key] ?? 0,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(76,95,219,0.06)" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
