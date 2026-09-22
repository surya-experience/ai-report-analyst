import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// SECURITY: no auth check — see README.md "Admin console has no login".
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: row } = await supabase.from("report_exports").select("storage_path").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "Export not found" }, { status: 404 });

  const { data: signed, error } = await supabase.storage
    .from("report-exports")
    .createSignedUrl(row.storage_path, 60);
  if (error || !signed) return NextResponse.json({ error: error?.message ?? "Could not sign URL" }, { status: 500 });

  return NextResponse.redirect(signed.signedUrl);
}
