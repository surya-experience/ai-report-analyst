import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { Topbar } from "@/components/layout/topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { completenessOf, FIELD_DEFS, getFieldValue, isFieldFilled } from "@/lib/profile-fields";
import { ClaimPanel } from "@/components/profile/claim-panel";
import { Progress } from "@/components/ui/progress";
import { Check, X } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: profile }, user] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).single(),
    getSessionUser(),
  ]);

  if (!profile) notFound();

  const completeness = completenessOf(profile);
  const isOwner = user?.id === profile.owner_id;
  const initials = profile.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <>
      <Topbar />
      <main className="flex-1 mx-auto w-full max-w-4xl px-6 py-10 grid md:grid-cols-[300px_1fr] gap-6 items-start">
        <Card className="md:sticky md:top-20">
          <CardContent className="pt-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-tight">{profile.name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.profession}</p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className={
                profile.status === "pro"
                  ? "bg-amber-100 text-amber-700"
                  : profile.status === "claimed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-stone-100 text-stone-600"
              }
            >
              {profile.status === "pro" ? "Pro" : profile.status === "claimed" ? "Claimed" : "Unclaimed"}
            </Badge>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Profile completeness</span>
                <span className="font-semibold">{completeness}%</span>
              </div>
              <Progress value={completeness} />
            </div>

            <div className="space-y-2 pt-2 border-t text-sm">
              <Row label="Company" value={profile.org} />
              <Row label="Location" value={profile.location} />
              <Row label="Email" value={profile.email ? maskEmail(profile.email) : null} />
              <Row label="Phone" value={profile.phone ? maskPhone(profile.phone) : null} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {profile.fields.headline && (
            <div>
              <p className="text-sm font-semibold text-amber-600 mb-1">
                {profile.profession}
                {profile.org ? ` at ${profile.org}` : ""}
              </p>
              <h1 className="text-2xl font-extrabold tracking-tight">{profile.fields.headline}</h1>
            </div>
          )}

          {profile.fields.summary && (
            <Card>
              <CardContent className="pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  About
                </h3>
                <p className="text-sm leading-relaxed">{profile.fields.summary}</p>
              </CardContent>
            </Card>
          )}

          {!!(profile.fields.skills?.length || profile.fields.services?.length) && (
            <Card>
              <CardContent className="pt-2 space-y-4">
                {!!profile.fields.skills?.length && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Skills
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.fields.skills.map((s) => (
                        <Badge key={s} variant="outline">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!!profile.fields.services?.length && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Services
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {profile.fields.services.map((s) => (
                        <Badge key={s} variant="outline">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!isOwner && profile.status === "unclaimed" && (
            <ClaimPanel profile={profile} isSignedIn={!!user} />
          )}

          {isOwner && (
            <Card className="border-indigo-200 bg-indigo-50/50">
              <CardContent className="pt-2 text-sm">
                This is your profile. Head to your{" "}
                <a href="/dashboard" className="font-semibold text-indigo-700 underline">
                  dashboard
                </a>{" "}
                to edit it or continue with the AI Coach.
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Profile checklist
              </h3>
              <ul className="space-y-1.5">
                {FIELD_DEFS.map((f) => {
                  const filled = isFieldFilled(f, getFieldValue(profile, f));
                  return (
                    <li key={f.key} className="flex items-center gap-2 text-sm">
                      {filled ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      )}
                      <span className={filled ? "" : "text-muted-foreground"}>{f.label}</span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value || <em className="text-muted-foreground font-normal">Not set</em>}</span>
    </div>
  );
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}•••@${d}`;
}
function maskPhone(phone: string) {
  return `${phone.slice(0, 2)} ••• •• ${phone.slice(-2)}`;
}
