import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminSupportInboxPage() {
  const supabase = await createClient();
  const { data: conversations } = await supabase
    .from("support_conversations")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(100);

  const open = conversations?.filter((c) => c.status !== "resolved" && c.status !== "closed") ?? [];
  const resolved = conversations?.filter((c) => c.status === "resolved" || c.status === "closed") ?? [];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Support inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">{open.length} open conversations</p>
      </div>

      <div className="space-y-2">
        {open.map((c) => (
          <ConversationRow key={c.id} c={c} />
        ))}
        {open.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">No open conversations. 🎉</p>
        )}
      </div>

      {resolved.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Resolved</h2>
          <div className="space-y-2">
            {resolved.map((c) => (
              <ConversationRow key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ConversationRow({
  c,
}: {
  c: { id: string; subject: string; status: string; channel: string; assigned_to: string | null; updated_at: string };
}) {
  return (
    <Link href={`/admin/support/${c.id}`}>
      <Card className="hover:border-indigo-300 transition-colors">
        <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{c.subject}</p>
            <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {c.channel === "human" && !c.assigned_to && c.status !== "resolved" && (
              <Badge className="bg-rose-100 text-rose-700">Needs agent</Badge>
            )}
            <Badge variant="outline">{c.channel === "ai" ? "AI" : "Human"}</Badge>
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
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
