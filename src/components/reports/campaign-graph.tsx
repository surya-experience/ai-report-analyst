"use client";

import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

export function CampaignGraph({ series }: { series: { date: string; sent: number; opened: number }[] }) {
  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">No sends recorded in this date range.</p>;
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
          <Line type="monotone" dataKey="sent" name="Sent (cumulative)" stroke="#4C5FDB" strokeWidth={2}>
            <LabelList dataKey="sent" position="top" style={{ fontSize: 11, fill: "#4C5FDB" }} />
          </Line>
          <Line type="monotone" dataKey="opened" name="Opened (cumulative)" stroke="#16A34A" strokeWidth={2}>
            <LabelList dataKey="opened" position="bottom" style={{ fontSize: 11, fill: "#16A34A" }} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
