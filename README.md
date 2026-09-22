# Experience.com — Profile Platform

Production Next.js app: claim, complete, and grow a professional profile — plus an internal admin console (profiles, campaigns, support, reports) and a per-member "view as" preview. Next.js 16 (App Router, TypeScript) + Tailwind + shadcn/ui, backed by Supabase (Postgres, Auth, Row-Level Security, Realtime) and the Anthropic API for the AI Coach, campaign copy, and Report Analyst.

The home page (`/`) redirects straight to `/admin` — that's this app's default landing page. The public profile directory (search/claim flow) lives at `/directory`.

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
- **AI features** (`src/app/api/ai/coach`, `src/app/api/support`, `src/app/api/campaigns/generate`, `src/app/api/reports/analyst`) all call the Anthropic API server-side.

## Admin: "View as"

From `/admin/profiles`, a claimed or Pro profile has a "View as" action that opens `/admin/view-as/[profileId]` — a read-only preview of that member's own dashboard (Search Rank Score gauge, profile score breakdown) and their own Reports page, with no separate sign-in (same no-auth model as the rest of `/admin`). It has its own layout/topbar (`src/components/view-as/`), independent of the admin shell's — "Log out" just returns to `/admin/profiles`.

The reports available while viewing as a member are user-level only — Campaign Delivery Status, Campaign Statistics, Survey Results, and Profile Statistics (`src/app/(view-as)/admin/view-as/[profileId]/reports/page.tsx`) — scoped to that one profile via `profileId`, everywhere from the report query itself down to the Report Analyst's context and each export's filename. Profile Statistics is only offered here, not on the admin Reports page, since it's one profile's own trend, not an admin-level report.

Exports are scoped per viewer too: `report_exports.profile_id` (migration `0009`) records who an export belongs to, so a member's "Recent exports" (attributed to their own name, not "Admin") persists across refresh and stays out of the admin's own Recent exports list, and vice versa.

## Reports

Six report types live in `src/lib/reports/definitions.ts`: Account Statistics, Campaign Delivery Status, Campaign Statistics, Survey Results, SRS Overview, and Profile Statistics. Each is a real query against this app's own schema — there is no synthetic data mixed into a live report's numbers. The admin Reports page (`/admin/reports`) offers all of these except Profile Statistics — see "View as" above for where that one lives.

Survey Results includes Agent and Campaign columns (joined through `survey_responses.profile_id` and `surveys.campaign_id`), and its chart preview adds "Responses by agent", "Responses by campaign", and "Average rating by agent" breakdown groups alongside the rating distribution — the aggregate chart mode (`src/lib/reports/chart-preview.ts`) supports these optional groups the same way the item/breakdown chart modes already did.

Two of these (Survey Results / SRS Overview, and Profile Statistics) cover domains — a survey-taking feature and a search-ranking system — that this app doesn't otherwise implement, modeled on a separate, more complete production reporting system. Their tables (`surveys`, `survey_responses`, `profile_daily_stats`) are seeded with sample data (`supabase/seed_reports.sql`, `supabase/seed_profile_stats.sql`) rather than produced by a real feature, and this is stated plainly wherever it matters (the Report Analyst's grounding, this doc).

`src/lib/reports/knowledge.ts` holds reference documentation for how each report type works in the full production system it's modeled on (columns, scoping rules, why a row might be missing, etc.), written from that system's actual docs. The Report Analyst (`src/app/api/reports/analyst`) is grounded on both this documentation *and* the report's live rows for the current selection — it's instructed to use the docs for "how/why" questions and the live data for "what/how many" questions, and to say plainly when a documented field or rule (e.g. organizations, tiers, agent roles) doesn't exist in this deployment's simpler schema, rather than pretending it applies.

Preview (`src/components/reports/preview-dialog.tsx`) renders as a modal, defaulting to a Table view (every row/column), with switchable Bar/Donut/Pie/Graph chart views. For the three "one row per thing over time" reports (the two campaign reports and Profile Statistics) the chart views page through individual items with prev/next arrows (hidden when there's only one to page through, e.g. Profile Statistics viewed as a single member), stat tiles, and a real day-by-day trend graph. Account Statistics pages through accounts the same way when "All accounts" is selected. A chart-type toggle and "Analyze this chart" / "Download chart" stay pinned to the bottom of the preview regardless of chart height, so they're never scrolled out of view. Every download (the Table's "Download report", export, or a chart's "Download chart" PNG) is named `{report}_for_{account}_generated_on_{timestamp}`, or `..._generated_from_{start}_{end}_{timestamp}` for date-filtered reports — see `src/lib/reports/filename.ts`.

Filters: Account Statistics has an account filter (`accounts` table). Campaign Delivery Status and Campaign Statistics have an adjustable date range (defaulting to the last 90 days); Campaign Delivery Status and Survey Results also have a campaign filter — Survey Results' filter works through `surveys.campaign_id` (added in `supabase/migrations/0006_survey_campaign_link.sql`), which links each survey to the campaign that requested it, matching how the real production system scopes survey/review reports by campaign.
