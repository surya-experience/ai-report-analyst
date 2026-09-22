import type { Profile, ProfileFields } from "@/types/database";

export interface FieldDef {
  key: keyof ProfileFields | "name" | "profession" | "org" | "location" | "email" | "phone";
  label: string;
  weight: number;
  top?: boolean;
  isList?: boolean;
  mapsTo?: "org" | "location";
}

// Mirrors compute_completeness() in supabase/migrations/0001_init.sql —
// keep both in sync if a field is added or reweighted.
export const FIELD_DEFS: FieldDef[] = [
  { key: "profession", label: "Profession", weight: 5, top: true },
  { key: "name", label: "Your name", weight: 5, top: true },
  { key: "email", label: "Email", weight: 5, top: true },
  { key: "phone", label: "Phone number", weight: 5, top: true },
  { key: "serviceArea", label: "Service area", weight: 6 },
  { key: "location", label: "City", weight: 5, top: true, mapsTo: "location" },
  { key: "photo", label: "Profile photo", weight: 8 },
  { key: "licence", label: "License / certifications", weight: 8, isList: true },
  { key: "businessHours", label: "Business hours", weight: 5 },
  { key: "yearStarted", label: "Year started", weight: 6 },
  { key: "org", label: "Works at", weight: 6, top: true, mapsTo: "org" },
  { key: "skills", label: "Skills", weight: 10, isList: true },
  { key: "services", label: "Services offered", weight: 10, isList: true },
  { key: "headline", label: "Professional headline", weight: 8 },
  { key: "summary", label: "Summary", weight: 9 },
];

export const COACH_QUESTIONS: Record<string, { q: string; why: string }> = {
  profession: { q: "What's your profession? (e.g. Real Estate Agent, Financial Advisor, Mortgage Broker)", why: "This determines which category your profile appears under." },
  name: { q: "What's your full name?", why: "This is how visitors will find and identify your profile." },
  email: { q: "What's the best email for account and client notifications?", why: "We'll use this for account and client communication." },
  phone: { q: "What's a good contact phone number?", why: "Visitors may want to reach you directly." },
  serviceArea: { q: "What area or neighborhoods do you serve?", why: "This helps you show up in searches for that area." },
  location: { q: "What city are you based in?", why: "Location helps visitors find local professionals." },
  photo: { q: "Do you have a profile photo to add?", why: "Profiles with a photo get significantly more views in search results." },
  licence: { q: "Any license number or certifications you'd like listed?", why: "Licenses and certifications build trust with visitors comparing profiles." },
  businessHours: { q: "What are your typical business hours?", why: "This sets expectations for when clients can reach you." },
  yearStarted: { q: "What year did you start working in this profession?", why: "This lets us show your years of experience accurately." },
  org: { q: "What company or brokerage do you work at?", why: "This appears alongside your name in search results." },
  skills: { q: "What are 2–3 skills or specialties you'd want listed?", why: "Skills help you show up in more relevant searches." },
  services: { q: "What services do you offer clients?", why: "Listing services sets clear expectations before someone reaches out." },
  headline: { q: "What's a one-line professional headline for your profile?", why: "Your headline appears right under your name in search results." },
};

export function getFieldValue(p: Pick<Profile, "name" | "profession" | "org" | "location" | "email" | "phone" | "fields">, f: FieldDef): unknown {
  if (f.top) return (p as Record<string, unknown>)[f.mapsTo ?? f.key];
  return p.fields[f.key as keyof ProfileFields];
}

export function isFieldFilled(f: FieldDef, v: unknown): boolean {
  if (f.isList) return Array.isArray(v) && v.length > 0;
  if (typeof v === "boolean") return v;
  return !!(typeof v === "string" && v.trim());
}

export function completenessOf(p: Pick<Profile, "name" | "profession" | "org" | "location" | "email" | "phone" | "fields">): number {
  let earned = 0;
  let total = 0;
  for (const f of FIELD_DEFS) {
    total += f.weight;
    if (isFieldFilled(f, getFieldValue(p, f))) earned += f.weight;
  }
  return Math.round((earned / total) * 100);
}

export function missingFields(p: Pick<Profile, "name" | "profession" | "org" | "location" | "email" | "phone" | "fields">): FieldDef[] {
  return FIELD_DEFS.filter((f) => !isFieldFilled(f, getFieldValue(p, f)));
}

// Builds the partial update to send to `profiles` for a single field write —
// either a top-level column (name/org/location/etc.) or a key inside the
// `fields` jsonb bag — so callers never have to know which case applies.
export function applyFieldPatch(
  profile: Pick<Profile, "fields">,
  fieldKey: string,
  value: unknown
): Partial<Profile> {
  const def = FIELD_DEFS.find((f) => f.key === fieldKey);
  if (!def) return {};
  if (def.top) {
    return { [def.mapsTo ?? def.key]: value } as Partial<Profile>;
  }
  return { fields: { ...profile.fields, [fieldKey]: value } };
}
