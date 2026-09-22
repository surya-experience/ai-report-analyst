# Experience.com — Profile Platform

Production Next.js app: claim, complete, and grow a professional profile. Next.js 16 (App Router, TypeScript) + Tailwind + shadcn/ui, backed by Supabase (Postgres, Auth, Row-Level Security, Realtime) and the Anthropic API for the AI Coach, campaign copy, and Report Analyst.

## ⚠️ Admin console has no login

By explicit decision, `/admin` and everything under it (profiles table, campaigns, support inbox, reports) has **no sign-in and no role check** — anyone who can reach the deployed URL can view and act on all profile data, campaigns, and support conversations. Every admin page and API route reads/writes through the Supabase **service-role** client (`src/lib/supabase/admin.ts`), which bypasses Row-Level Security entirely, since there's no user session for RLS to authorize against.

This is fine for a local demo behind a private URL. It is **not safe to deploy publicly** with real user data behind it. To re-enable auth on the admin console:
1. In `src/app/admin/layout.tsx`, restore the `getSessionUser()` check and redirect (see git history for the original version).
2. In each admin page (`src/app/admin/**/page.tsx`) and admin-only API route (`src/app/api/campaigns/**`, `src/app/api/reports/analyst`, `src/app/api/admin/support/**`), swap `createAdminClient()` back to the request-scoped `createClient()` from `src/lib/supabase/server.ts` and add back a `requireStaff()`-style check — RLS policies for staff access already exist in the migration and don't need to change.

The member-facing side (profile claiming, the AI Coach, member support tickets, Pro checkout) still requires sign-in and is unaffected by this.

## Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Recharts
- **Backend**: Supabase Postgres with RLS, Supabase Auth (email OTP), Supabase Realtime
- **AI**: Anthropic Claude API (tool-use for the AI Coach and campaign drafting)
- **Email**: pluggable via `src/lib/email/send.ts` (Resend by default, logs in dev without a key)
- **Billing**: Stripe Checkout + webhook for the Pro subscription
- **Hosting**: Vercel

## First-time setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com).
2. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings → API.
   - `ANTHROPIC_API_KEY` — from [console.anthropic.com](https://console.anthropic.com).
   - Stripe and Resend keys are optional; the app degrades gracefully without them (see below).
3. Push the schema:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This runs `supabase/migrations/0001_init.sql`, which creates every table, RLS policy, trigger, and the `claim_profile` RPC.
4. (Optional) Seed sample data for local development:
   ```bash
   psql "$(npx supabase status -o json | jq -r .DB_URL)" -f supabase/seed.sql
   ```
   or paste `supabase/seed.sql` into the Supabase SQL editor for your project.
5. (Only needed if you re-enable admin auth — see above) **Promote yourself to admin**: sign in once through the app, then in the Supabase SQL editor:
   ```sql
   update public.user_roles set role = 'admin' where user_id = (select id from auth.users where email = 'you@example.com');
   ```
6. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Optional integrations

- **Email (campaigns)**: without `RESEND_API_KEY`, campaign sends are logged to the server console instead of delivered — the rest of the flow (segment resolution, send tracking) still works. Set `RESEND_API_KEY` and `EMAIL_FROM` to actually deliver.
- **Billing (Pro upgrade)**: without `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID`, the Upgrade button returns a clear "billing not configured" error. To enable: create a Stripe product/price, set `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID`, and point a Stripe webhook at `/api/billing/webhook` (listening for `checkout.session.completed` and `customer.subscription.deleted`) with its signing secret in `STRIPE_WEBHOOK_SECRET`.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel, set the same environment variables from `.env.local` in the Vercel project settings (use your **production** Supabase/Stripe/Resend values, and set `NEXT_PUBLIC_SITE_URL` to your deployed domain).
3. In Supabase Auth settings, add your Vercel domain to the allowed redirect URLs.
4. Deploy. Run the migration against your production Supabase project the same way as step 3 above, pointed at the production project ref.

## Architecture notes

- **Row-Level Security is the authorization boundary**, not the UI. Every table has explicit policies in `supabase/migrations/0001_init.sql`; the app's server routes rely on those policies rather than re-implementing access control in TypeScript. `src/lib/supabase/admin.ts` (service role, bypasses RLS) is only used for the Stripe webhook, which has no user session to authorize against.
- **Claiming a profile** is done via the `claim_profile` Postgres function (`SECURITY DEFINER`), which only succeeds if the caller is signed in as the profile's own verified email — enforced in SQL, not just in the UI.
- **`src/lib/profile-fields.ts`** mirrors the completeness-scoring logic in the `compute_completeness` SQL trigger, so the client can render an accurate percentage without a round-trip; keep both in sync if a field is added.
- **AI features** (`src/app/api/ai/coach`, `src/app/api/support`, `src/app/api/campaigns/generate`, `src/app/api/reports/analyst`) all call the Anthropic API server-side. The Report Analyst is grounded by passing it the exact same JSON (`src/lib/reports/data.ts`) that renders the charts, so it can't answer from numbers the page doesn't also show.
