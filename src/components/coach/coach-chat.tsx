"use client";

import { useEffect, useRef, useState } from "react";
import type { AiMessage, Profile } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { completenessOf } from "@/lib/profile-fields";
import { cn } from "@/lib/utils";
import { Loader2, Send } from "lucide-react";

const OPENING: AiMessage = {
  role: "assistant",
  text: "Hi! I'm your AI Profile Coach. I'll ask a few quick questions to fill in what's missing from your profile — answer in your own words and I'll take care of the rest. Ready?",
  ts: new Date().toISOString(),
};

export function CoachChat({
  profile: initialProfile,
  initialMessages,
}: {
  profile: Profile;
  initialMessages: AiMessage[];
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [messages, setMessages] = useState<AiMessage[]>(
    initialMessages.length ? initialMessages : [OPENING]
  );
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text, ts: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId: profile.id, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setProfile(data.profile);
      setMessages((m) => [...m, { role: "assistant", text: data.reply, ts: new Date().toISOString() }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `Sorry, I hit an error: ${err instanceof Error ? err.message : "please try again"}.`,
          ts: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const completeness = completenessOf(profile);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 mb-4">
        <Progress value={completeness} className="flex-1" />
        <span className="text-xs font-semibold text-muted-foreground shrink-0">
          {completeness}% complete
        </span>
      </div>

      <Card className="flex-1 flex flex-col min-h-[520px]">
        <CardContent className="flex-1 flex flex-col p-4 min-h-0">
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.role === "assistant"
                    ? "bg-muted self-start rounded-bl-sm"
                    : "bg-indigo-600 text-white self-end ml-auto rounded-br-sm"
                )}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div className="bg-muted self-start rounded-xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-1.5 w-fit">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={send} className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer…"
              disabled={loading}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
