"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

export function SendCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function send() {
    if (!confirm("Send this campaign now? This will email everyone in the segment.")) return;
    setSending(true);
    const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) {
      toast.error(data.error ?? "Send failed");
      return;
    }
    toast.success(`Sent to ${data.sent} of ${data.total} profiles${data.failed ? ` (${data.failed} failed)` : ""}`);
    router.refresh();
  }

  return (
    <Button onClick={send} disabled={sending}>
      {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
      {sending ? "Sending…" : "Send campaign"}
    </Button>
  );
}
