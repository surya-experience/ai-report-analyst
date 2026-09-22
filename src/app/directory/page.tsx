import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/topbar";
import { ProfileCard } from "@/components/profile/profile-card";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("*")
    .order("last_activity_at", { ascending: false })
    .limit(30);

  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(
      `name.ilike.%${term}%,profession.ilike.%${term}%,org.ilike.%${term}%,location.ilike.%${term}%`
    );
  }

  const { data: profiles, error } = await query;

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold text-amber-600 mb-1">Professional Directory</p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {q ? `Results for "${q}"` : "Find and claim your professional profile"}
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Search by name, profession, company, or city. If you find your profile, you can
            claim it in under two minutes.
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive">Couldn&apos;t load profiles: {error.message}</p>
        )}

        {!error && (!profiles || profiles.length === 0) && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium mb-1">No profiles found</p>
            <p className="text-sm">Try a different name, profession, or city.</p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {(profiles as Profile[] | null)?.map((p) => (
            <ProfileCard key={p.id} profile={p} />
          ))}
        </div>
      </main>
    </>
  );
}
