import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import { generateCampaignDraft } from "@/lib/ai/campaigns";

export async function POST(req: NextRequest) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { instruction } = (await req.json()) as { instruction: string };
  if (!instruction?.trim()) {
    return NextResponse.json({ error: "instruction is required" }, { status: 400 });
  }

  try {
    const draft = await generateCampaignDraft(instruction.trim());
    return NextResponse.json({ draft });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not generate campaign" },
      { status: 500 }
    );
  }
}
