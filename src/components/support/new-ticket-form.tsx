"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function NewTicketForm({ profileId }: { profileId?: string }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, message, profileId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not open ticket");
      return;
    }
    router.push(`/dashboard/support/${data.conversation.id}`);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="pt-2">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">What&apos;s this about?</Label>
            <Input id="subject" required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Trouble claiming my profile" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" required value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe what's going on…" />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Starting chat…" : "Start conversation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
