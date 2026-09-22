import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { NewTicketForm } from "@/components/support/new-ticket-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/support");

  const supabase = await createClient();
  const [{ data: conversations }, { data: profile }] = await Promise.all([
    supabase
      .from("support_conversations")
      .select("*")
      .eq("requester_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id").eq("owner_id", user.id).limit(1).maybeSingle(),
  ]);

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Support</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Chat with our AI assistant, or ask for a human anytime.
          </p>
        </div>

        <NewTicketForm profileId={profile?.id} />

        {!!conversations?.length && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">Your conversations</h2>
            <div className="space-y-2">
              {conversations.map((c) => (
                <Link key={c.id} href={`/dashboard/support/${c.id}`}>
                  <Card className="hover:border-indigo-300 transition-colors">
                    <CardContent className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(c.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          c.status === "resolved" || c.status === "closed"
                            ? "bg-stone-100 text-stone-600"
                            : c.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }
                      >
                        {c.status}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
