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

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin" && user.role !== "support") {
    throw new Error("FORBIDDEN");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
