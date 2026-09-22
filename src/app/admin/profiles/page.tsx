import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { UserCog } from "lucide-react";
import { completenessOf } from "@/lib/profile-fields";
import { ProfileFilters } from "@/components/admin/profile-filters";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function AdminProfilesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
  const supabase = createAdminClient();

  let query = supabase.from("profiles").select("*", { count: "exact" });
  if (status && status !== "all") {
    query = query.eq("status", status as "unclaimed" | "claimed" | "pro");
  }
  if (q?.trim()) {
    const term = q.trim();
    query = query.or(
      `name.ilike.%${term}%,profession.ilike.%${term}%,org.ilike.%${term}%,location.ilike.%${term}%`
    );
  }
  const from = (page - 1) * PAGE_SIZE;
  const { data: profiles, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Profiles</h1>
          <p className="text-sm text-muted-foreground mt-1">{count ?? 0} total</p>
        </div>
        <ProfileFilters />
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Complete</TableHead>
              <TableHead>Created</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/p/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.profession}</TableCell>
                <TableCell className="text-muted-foreground">{p.location}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      p.status === "pro"
                        ? "bg-amber-100 text-amber-700"
                        : p.status === "claimed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-100 text-stone-600"
                    }
                  >
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell>{completenessOf(p)}%</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {p.status !== "unclaimed" && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/view-as/${p.id}`}>
                        <UserCog className="h-3.5 w-3.5 mr-1.5" />
                        View as
                      </Link>
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {profiles?.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No profiles match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <span>
          Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link
              className="underline"
              href={`?${new URLSearchParams({ q: q ?? "", status: status ?? "", page: String(page - 1) })}`}
            >
              Previous
            </Link>
          )}
          {page < totalPages && (
            <Link
              className="underline"
              href={`?${new URLSearchParams({ q: q ?? "", status: status ?? "", page: String(page + 1) })}`}
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
