import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type Stripe from "stripe";

// Stripe calls this directly — there's no signed-in user, so it verifies
// the request via the webhook signature instead of a session, and writes
// through the service-role client since RLS has no policy that would let
// an unauthenticated caller flip a profile to Pro.
export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json({ error: `Invalid signature: ${err}` }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const profileId = session.metadata?.profile_id ?? session.client_reference_id;
    if (profileId) {
      await supabase.from("profiles").update({ status: "pro" }).eq("id", profileId);
      await supabase.from("subscriptions").upsert(
        {
          profile_id: profileId,
          plan: "pro",
          status: "active",
          provider: "stripe",
          provider_customer_id: String(session.customer ?? ""),
          provider_subscription_id: String(session.subscription ?? ""),
        },
        { onConflict: "profile_id" }
      );
      await supabase.from("conversion_events").insert({ type: "subscription_activated", profile_id: profileId });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const { data: row } = await supabase
      .from("subscriptions")
      .select("profile_id")
      .eq("provider_subscription_id", sub.id)
      .maybeSingle();
    if (row) {
      await supabase.from("subscriptions").update({ status: "canceled" }).eq("profile_id", row.profile_id);
      await supabase.from("profiles").update({ status: "claimed" }).eq("id", row.profile_id);
    }
  }

  return NextResponse.json({ received: true });
}
