import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ViewAsTopbar } from "@/components/view-as/topbar";
import { ViewAsSidebar } from "@/components/view-as/sidebar";

// SECURITY: no auth check — admin-only impersonation preview, not a real
// sign-in. See README.md "Admin console has no login" and
// components/view-as/topbar.tsx.
export default async function ViewAsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const supabase = createAdminClient();
  const { data: profile } = await supabase.from("profiles").select("id, name, status").eq("id", profileId).single();
  if (!profile || profile.status === "unclaimed") notFound();

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <ViewAsTopbar profileName={profile.name} />
      <div className="flex flex-1 min-h-0">
        <ViewAsSidebar profileId={profile.id} />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
