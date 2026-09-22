import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string | null;
  role: AppRole;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: roleRow } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (roleRow?.role as AppRole) ?? "member",
  };
}

