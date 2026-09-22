import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { SupportChat } from "@/components/support/support-chat";

export const dynamic = "force-dynamic";

export default async function SupportConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=/dashboard/support/${id}`);

  const supabase = await createClient();
  const [{ data: convo }, { data: messages }] = await Promise.all([
    supabase.from("support_conversations").select("*").eq("id", id).single(),
    supabase.from("support_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
  ]);

  if (!convo || convo.requester_id !== user.id) notFound();

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-2xl px-6 py-10">
        <SupportChat conversation={convo} initialMessages={messages ?? []} isStaff={false} />
      </main>
    </>
  );
}
