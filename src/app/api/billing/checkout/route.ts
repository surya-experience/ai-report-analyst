import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { profileId } = (await req.json()) as { profileId: string };
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).single();
  if (!profile || profile.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!process.env.STRIPE_PRICE_ID) {
    return NextResponse.json(
      { error: "Billing isn't configured yet — set STRIPE_SECRET_KEY and STRIPE_PRICE_ID." },
      { status: 503 }
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
    customer_email: user.email,
    client_reference_id: profile.id,
    metadata: { profile_id: profile.id },
    success_url: `${siteUrl}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl}/dashboard/upgrade`,
  });

  return NextResponse.json({ url: session.url });
}
