import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { CoachChat } from "@/components/coach/coach-chat";

export const dynamic = "force-dynamic";

export default async function CoachPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/coach");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("owner_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!profile) redirect("/dashboard");

  const { data: convo } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("profile_id", profile.id)
    .eq("kind", "coach")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-8 flex flex-col">
        <h1 className="text-xl font-extrabold tracking-tight mb-1">AI Profile Coach</h1>
        <p className="text-sm text-muted-foreground mb-6">
          A quick conversation to fill in the rest of your profile.
        </p>
        <CoachChat profile={profile} initialMessages={convo?.messages ?? []} />
      </main>
    </>
  );
}
