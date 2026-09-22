"use client";

import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ReportData } from "@/lib/reports/data";

const COLORS = ["#4C5FDB", "#7C3AED", "#F5821F", "#16A34A", "#0EA5E9", "#C0269C"];

export function StatusPie({ data }: { data: ReportData["statusCounts"] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={45} outerRadius={75} paddingAngle={2}>
            {data.map((_, i) => (
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

export function CompletenessBars({ data }: { data: ReportData["completenessBuckets"] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgba(76,95,219,0.06)" }} />
          <Bar dataKey="count" fill="#4C5FDB" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WeeklyLine({
  signups,
  claims,
}: {
  signups: ReportData["signupsByWeek"];
  claims: ReportData["claimsByWeek"];
}) {
  const weeks = [...new Set([...signups.map((s) => s.week), ...claims.map((c) => c.week)])].sort();
  const merged = weeks.map((week) => ({
    week: week.slice(5),
    signups: signups.find((s) => s.week === week)?.count ?? 0,
    claims: claims.find((c) => c.week === week)?.count ?? 0,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={merged}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="signups" name="New profiles" stroke="#4C5FDB" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="claims" name="Claims" stroke="#F5821F" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ProfessionBars({ data }: { data: ReportData["topProfessions"] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 12 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
          <XAxis type="number" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
          <YAxis type="category" dataKey="profession" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={130} />
          <Tooltip cursor={{ fill: "rgba(76,95,219,0.06)" }} />
          <Bar dataKey="count" fill="#7C3AED" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
