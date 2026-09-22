import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SupportChat } from "@/components/support/support-chat";

export const dynamic = "force-dynamic";

export default async function AdminSupportConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: convo }, { data: messages }] = await Promise.all([
    supabase.from("support_conversations").select("*").eq("id", id).single(),
    supabase.from("support_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
  ]);

  if (!convo) notFound();

  return (
    <div className="max-w-2xl">
      <SupportChat conversation={convo} initialMessages={messages ?? []} isStaff />
    </div>
  );
}
