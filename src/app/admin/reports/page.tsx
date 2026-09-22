import { createAdminClient } from "@/lib/supabase/admin";
import { buildReportData } from "@/lib/reports/data";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPie, CompletenessBars, WeeklyLine, ProfessionBars } from "@/components/reports/charts";
import { ReportAnalyst } from "@/components/reports/report-analyst";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createAdminClient();
  const report = await buildReportData(supabase);

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live from the database — {report.totals.profiles} profiles, {report.totals.openSupportTickets} open
          support tickets.
        </p>
      </div>

      <ReportAnalyst />

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-2">
            <h2 className="text-sm font-semibold mb-2">Profiles by status</h2>
            <StatusPie data={report.statusCounts} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-2">
            <h2 className="text-sm font-semibold mb-2">Completeness distribution</h2>
            <CompletenessBars data={report.completenessBuckets} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-2">
          <h2 className="text-sm font-semibold mb-2">New profiles & claims, last 12 weeks</h2>
          <WeeklyLine signups={report.signupsByWeek} claims={report.claimsByWeek} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-2">
          <h2 className="text-sm font-semibold mb-2">Top professions</h2>
          <ProfessionBars data={report.topProfessions} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-2">
          <h2 className="text-sm font-semibold mb-3">Campaign performance</h2>
          {report.campaignPerformance.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No campaigns sent yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Segment</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Clicked</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.campaignPerformance.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.segment}</TableCell>
                    <TableCell>{c.sent}</TableCell>
                    <TableCell>{c.opened}</TableCell>
                    <TableCell>{c.clicked}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
