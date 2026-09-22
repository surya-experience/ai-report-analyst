"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupportConversation, SupportMessage } from "@/types/database";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Send, UserRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_STYLE: Record<SupportConversation["status"], string> = {
  open: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  resolved: "bg-stone-100 text-stone-600",
  closed: "bg-stone-100 text-stone-600",
};

const SENDER_LABEL: Record<SupportMessage["sender_type"], string> = {
  member: "You",
  agent: "Support agent",
  ai: "AI Assistant",
};

export function SupportChat({
  conversation: initialConvo,
  initialMessages,
  isStaff,
}: {
  conversation: SupportConversation;
  initialMessages: SupportMessage[];
  isStaff: boolean;
}) {
  const supabase = createClient();
  const [convo, setConvo] = useState(initialConvo);
  const [messages, setMessages] = useState<SupportMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`support-${convo.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${convo.id}` },
        (payload) => {
          const row = payload.new as SupportMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations", filter: `id=eq.${convo.id}` },
        (payload) => {
          setConvo(payload.new as SupportConversation);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo.id]);

  // Staff actions go through /api/admin/support/*, which has no auth check
  // (the admin console has no login by design — see README.md). Member
  // actions go through /api/support/*, which still requires the member's
  // own session.
  const base = isStaff ? `/api/admin/support/${convo.id}` : `/api/support/${convo.id}`;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput("");
    const res = await fetch(`${base}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text }),
    });
    setSending(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Could not send message");
    }
  }

  async function requestHuman() {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "request_human" }),
    });
    if (res.ok) toast.success("A human agent has been notified.");
  }

  async function staffAction(action: "take" | "resolve" | "reopen") {
    const res = await fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Action failed");
    }
  }

  return (
    <Card className="flex flex-col h-[560px]">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b flex-wrap">
        <div>
          <p className="font-semibold text-sm">{convo.subject}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className={STATUS_STYLE[convo.status]}>
              {convo.status}
            </Badge>
            <Badge variant="outline">{convo.channel === "ai" ? "AI" : "Human"}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {!isStaff && convo.channel === "ai" && (
            <Button size="sm" variant="outline" onClick={requestHuman}>
              <UserRound className="h-3.5 w-3.5 mr-1" /> Talk to a human
            </Button>
          )}
          {isStaff && (convo.channel !== "human" || convo.status === "pending") && (
            <Button size="sm" variant="outline" onClick={() => staffAction("take")}>
              Take conversation
            </Button>
          )}
          {isStaff && convo.status !== "resolved" && (
            <Button size="sm" variant="outline" onClick={() => staffAction("resolve")}>
              Resolve
            </Button>
          )}
          {isStaff && convo.status === "resolved" && (
            <Button size="sm" variant="outline" onClick={() => staffAction("reopen")}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      <CardContent className="flex-1 flex flex-col p-4 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.map((m) => (
            <div key={m.id} className={cn("max-w-[85%]", m.sender_type === "member" ? "ml-auto" : "")}>
              <p
                className={cn(
                  "text-[10px] font-semibold uppercase tracking-wide mb-1",
                  m.sender_type === "member" ? "text-right text-indigo-600" : "text-muted-foreground"
                )}
              >
                {SENDER_LABEL[m.sender_type]}
              </p>
              <div
                className={cn(
                  "rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                  m.sender_type === "member"
                    ? "bg-indigo-600 text-white rounded-br-sm"
                    : "bg-muted rounded-bl-sm"
                )}
              >
                {m.body}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {convo.status !== "resolved" && (
          <form onSubmit={send} className="flex gap-2 mt-4 pt-4 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
