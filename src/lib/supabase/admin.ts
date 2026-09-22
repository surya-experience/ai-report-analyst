import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Bypasses RLS entirely — server-only. Never import this into client code
// or any module that can end up in a client bundle. Reserved for trusted
// background operations (OTP verification handoff, admin seeding, webhooks)
// where the caller's identity has already been authenticated another way.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
