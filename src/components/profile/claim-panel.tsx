"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

type Step = "intro" | "sent" | "verifying" | "done";

export function ClaimPanel({ profile }: { profile: Profile; isSignedIn: boolean }) {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<Step>("intro");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maskedEmail = profile.email ? maskEmail(profile.email) : null;

  async function sendCode() {
    if (!profile.email) {
      setError("This profile has no email on file to verify against.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: profile.email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("sent");
  }

  async function verifyAndClaim(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.email) return;
    setLoading(true);
    setError(null);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: profile.email,
      token: code,
      type: "email",
    });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }

    const { error: claimError } = await supabase.rpc("claim_profile", {
      p_profile_id: profile.id,
    });
    setLoading(false);
    if (claimError) {
      setError(claimError.message);
      return;
    }
    setStep("done");
    toast.success("Profile claimed! Redirecting to your dashboard…");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <Card className="border-indigo-200">
      <CardContent className="pt-2 space-y-4">
        <div>
          <p className="text-sm font-semibold text-indigo-700 mb-1">Is this you?</p>
          <p className="text-sm text-muted-foreground">
            Claiming this profile lets you verify it&apos;s really you, correct anything that&apos;s
            out of date, and control what visitors see. Right now anyone can view it, but no one
            can edit it until it&apos;s claimed.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === "intro" && (
          <Button onClick={sendCode} disabled={loading || !profile.email}>
            {loading ? "Sending code…" : `Verify with ${maskedEmail ?? "email"}`}
          </Button>
        )}

        {(step === "sent" || step === "verifying") && (
          <form onSubmit={verifyAndClaim} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              We sent a 6-digit code to {maskedEmail}. Enter it below to confirm this is you.
            </p>
            <div className="flex gap-2">
              <Input
                autoFocus
                inputMode="numeric"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="max-w-[160px]"
              />
              <Button type="submit" disabled={loading || code.length < 6}>
                {loading ? "Verifying…" : "Verify & claim"}
              </Button>
            </div>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={sendCode}
              disabled={loading}
            >
              Resend code
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  return `${u.slice(0, 2)}•••@${d}`;
}
