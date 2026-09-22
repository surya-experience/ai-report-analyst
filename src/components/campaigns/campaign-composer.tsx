"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SEGMENTS, type SegmentKey } from "@/lib/campaigns/segments";
import { toast } from "sonner";
import { Sparkles, Loader2 } from "lucide-react";

interface Draft {
  name: string;
  segment: SegmentKey;
  subject: string;
  body: string;
}

export function CampaignComposer() {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  async function generate() {
    if (!instruction.trim()) return;
    setGenerating(true);
    const res = await fetch("/api/campaigns/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    const data = await res.json();
    setGenerating(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not generate a draft");
      return;
    }
    setDraft(data.draft);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not save campaign");
      return;
    }
    router.push(`/admin/campaigns/${data.campaign.id}`);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-2 space-y-3">
          <Label htmlFor="instruction">Describe the campaign you want</Label>
          <Textarea
            id="instruction"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Remind unclaimed profiles that are mostly filled out to finish claiming"
            rows={3}
          />
          <Button onClick={generate} disabled={generating || !instruction.trim()}>
            {generating ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            {generating ? "Drafting…" : "Draft with AI"}
          </Button>
        </CardContent>
      </Card>

      {draft && (
        <Card className="border-indigo-200">
          <CardContent className="pt-2 space-y-4">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Review & edit</p>
            <div className="space-y-1.5">
              <Label>Campaign name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Audience segment</Label>
              <Select value={draft.segment} onValueChange={(v) => setDraft({ ...draft, segment: v as SegmentKey })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SEGMENTS).map(([key, s]) => (
                    <SelectItem key={key} value={key}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject line</Label>
              <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea rows={8} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save as draft"}
              </Button>
              <Button variant="outline" onClick={generate} disabled={generating}>
                Regenerate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
