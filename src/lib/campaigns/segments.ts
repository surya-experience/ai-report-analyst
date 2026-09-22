import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/types/database";
import { completenessOf } from "@/lib/profile-fields";

// Every segment here maps to a real, honest query against `profiles` — no
// segment is included unless we actually track the data behind it (this is
// why an "abandoned checkout" segment from the original mock isn't here:
// there's no real checkout-attempt tracking yet).
export const SEGMENTS = {
  unclaimed: {
    label: "Unclaimed profiles",
    description: "Profiles nobody has claimed yet.",
  },
  claim_reminder: {
    label: "Almost-claimed profiles",
    description: "Unclaimed profiles that are already well filled out (50%+ complete).",
  },
  incomplete: {
    label: "Incomplete profiles",
    description: "Claimed profiles under 60% complete.",
  },
  pro_eligible: {
    label: "Pro-eligible profiles",
    description: "Claimed, non-Pro profiles that are 70%+ complete.",
  },
  re_engagement: {
    label: "Inactive claimed profiles",
    description: "Claimed profiles with no activity in the last 30 days.",
  },
} as const;

export type SegmentKey = keyof typeof SEGMENTS;

export async function resolveSegmentProfiles(
  supabase: SupabaseClient<Database>,
  segment: SegmentKey
): Promise<Profile[]> {
  let query = supabase.from("profiles").select("*").not("email", "is", null);

  if (segment === "unclaimed" || segment === "claim_reminder") {
    query = query.eq("status", "unclaimed");
  } else if (segment === "incomplete") {
    query = query.eq("status", "claimed");
  } else if (segment === "pro_eligible") {
    query = query.eq("status", "claimed");
  } else if (segment === "re_engagement") {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    query = query.eq("status", "claimed").lt("last_activity_at", cutoff);
  }

  const { data, error } = await query.limit(500);
  if (error || !data) return [];

  // Completeness thresholds aren't stored columns, so filter in JS using
  // the same weighting the DB trigger uses.
  if (segment === "claim_reminder") return data.filter((p) => completenessOf(p) >= 50);
  if (segment === "incomplete") return data.filter((p) => completenessOf(p) < 60);
  if (segment === "pro_eligible") return data.filter((p) => completenessOf(p) >= 70);
  return data;
}
