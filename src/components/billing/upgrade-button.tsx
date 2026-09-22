"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function UpgradeButton({ profileId }: { profileId: string }) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    setLoading(true);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) {
      setLoading(false);
      toast.error(data.error ?? "Could not start checkout");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <Button size="lg" onClick={startCheckout} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : null}
      {loading ? "Redirecting to checkout…" : "Upgrade to Pro"}
    </Button>
  );
}
