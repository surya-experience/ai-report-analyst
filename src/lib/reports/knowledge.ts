import "server-only";

// Domain documentation for each report type, written for a real production
// reporting system (org/account/tier hierarchy, agent search-rank scoring,
// review-reply linkage, etc.) that this app's simpler schema doesn't fully
// implement — see README.md "Reports" for the scope note. The Report
// Analyst is grounded on this text for "how does this report work / why is
// something missing" questions, alongside the live rows for "what does the
// data say right now" questions. Where the two disagree (e.g. this app has
// no organization/tier hierarchy), the analyst is instructed to say so
// rather than pretend the live schema has fields it doesn't.
export const REPORT_KNOWLEDGE: Record<string, string> = {
  account_statistics: `
# Account Statistics Report — how it works (reference documentation)

Full production version: a snapshot of account/organization health — campaign activity, survey volume/completion, user/tier counts, publishing status, and social/online-presence completeness (Facebook/Twitter/LinkedIn, Google My Business, missing photos/URLs). Scoped by role (Super Admin sees org-wide, Admin/Org Manager limited to their org, Account Manager limited to their accounts) and does NOT take a date range — it's a point-in-time snapshot, not historical.

Key columns in the full version: Number of Tiers, Number of Locations, Number of Users, Number of Verified Users, Number of Active/Inactive campaigns, surveys sent/completed, Completion rate % (completed÷sent×100, shows "N/A" if >100%, a data anomaly), tiers/agents with Facebook/Twitter/LinkedIn connected, Verified/Missing GMB, Missing Photos/URLs.

Why an account might be missing: not in an active/reportable status, or outside the requester's role-based scope.

**This app's version is simpler**: it tracks individual professional profiles (claimed/unclaimed/Pro status, completeness %) rather than a full account→organization→tier hierarchy with social/GMB tracking. If asked about columns this app doesn't have (organizations, tiers, GMB, social connections), say plainly that this deployment doesn't track that yet, rather than inventing a number.
`.trim(),

  campaign_delivery: `
# Campaign Delivery Status Report — how it works (reference documentation)

Full production version: one row per individual survey send to one reviewer (transaction-level, not a summary) — who it was sent to, delivery timing, current status (Survey Sent / First-Third Reminder Sent / Survey Completed Successfully), email/SMS reminder counts, and reviewer contact details. Scoped by a start/end date (filtered on the delivery metric date), and either by hierarchy (org/account/tier) or by specific agent(s). Agent-role requesters only see campaigns that are public, third-party, transferred, or assigned to them.

Why a row might be missing: its status isn't one of the tracked delivery/completion states, it's outside the date range, or it's outside the requested campaign/tier/agent scope. "User Status" is blank when there's no matching user record.

Known quirk: "Survey status" only tracks sent/reminder-stage/completed — bounced or opted-out sends are simply excluded, not shown with their own status label.

**This app's version**: one row per email send in \`campaign_sends\`, with a simpler status set (queued/sent/opened/clicked/bounced/failed) and no reminder-cadence, SMS, or agent-role scoping — those columns don't exist in this deployment.
`.trim(),

  campaign_statistics: `
# Campaign Statistics Report — how it works (reference documentation)

Full production version: one row per campaign, summarizing survey activity in a date range — surveys sent, completed, a Completion Score (completed÷sent×100, "N/A" if completed>sent), an Average Score (per-response score average, "N/A" if scoring is disabled for that campaign), Last Survey sent date, and a Click Rate (despite the name, calculated the same way as Completion Score — completed÷sent as a decimal, NOT real link/email click tracking).

**Zero-activity campaigns are omitted, not zeroed out** — if a campaign had no activity in the date range, it simply won't appear in the report at all, even if it's otherwise active. This is the single most common reason a known campaign seems "missing" from this report.

Also excluded: transferred, third-party, or "no survey" campaigns; non-reportable statuses; wrong account. Tier Managers only see their tier's campaigns.

**This app's version**: one row per campaign in \`campaigns\`, with Sent/Opened/Clicked counts and rates computed from real \`campaign_sends\` rows — "Click rate" here IS a real click metric (from send status), unlike the production system's same-named-but-different metric. Campaigns with zero sends still appear with 0s in this app's version, rather than being omitted.
`.trim(),

  survey_results: `
# Survey Results Report — how it works (reference documentation)

Full production version: one row per completed survey response — reviewer/agent details, timing, overall Survey Score, every question's answer (one column per question; matrix questions expand into sub-answer columns), custom fields, reply info, and secondary-site click activity. Scoped by completion date (not send date), and by hierarchy/agent/campaign selection.

**A completed survey only appears if it has an associated, non-archived, non-duplicate review-reply record.** A survey can be genuinely completed and still not appear here without that link — this is the single biggest reason a known completion seems "missing." Zillow/Facebook-referred responses are always excluded. Deactivated agents' responses are excluded unless "show all statuses" is selected.

**This app's version**: seeded sample data (\`survey_responses\`) simulating two surveys (Client Satisfaction, Onboarding Experience) with a respondent name, 1-5 star rating, optional comment, and date — there's no review-reply linkage, question/answer schema, or agent-role scoping in this deployment; this app has no real survey-taking feature elsewhere, so treat this report's numbers as illustrative sample data, not live customer feedback.
`.trim(),

  srs_overview: `
# SRS Overview Report — how it works (reference documentation)

"SRS" = Search Rank Score. Full production version: one row per agent — their overall Search Rank Score (sum of 5 category scores: Reviews Replies, Profile Completion, Social Connections, Web Analytics, Listings), Location-based Rank (vs. similar agents in the same profession/state/city — lower is better), Total Experience Score (avg. customer rating — NOT part of the Search Rank Score sum despite sitting next to it), profile visit count, and a Top 5% flag (requires: score at/above the top-percentile threshold for their vertical/country, AND ≥5 recent reviews, AND a profile photo — all three).

Only active/onboarding agents by default (or only deactivated, if selected) with recorded ranking data appear. Location-based Rank and Top 5% are blank for deactivated agents.

**This app's version**: adapted to survey ratings instead of a real search-ranking system — it shows response count and average star rating per survey, with 5-star and 1-star counts as a simple distribution. There's no location-based ranking, category-score breakdown, or Top 5% flag in this deployment.
`.trim(),

  profile_statistics: `
# Profile Statistics Report — how it works (reference documentation)

Full production version: a day-by-day trend for a SINGLE agent — their Location-based Rank, Profile Views, Search Rank Score and its 5 category components, Total Experience Score, and Top 5% flag, for each day in a date range. Historical days come from stored daily snapshots; if the range includes today, an additional "today" row is computed live from roughly the last 24 hours rather than waiting for a finalized snapshot — so today's numbers can shift slightly once tomorrow's snapshot for today is generated. This is the same underlying metric set as the SRS Overview report, but trended over time for one agent instead of all agents at one point in time.

**This app's version**: seeded sample daily data (\`profile_daily_stats\`) for a small set of claimed profiles, with the same column shape (rank, views, score + 5 category points, experience score, top-5% flag) — illustrative sample data rather than a real search-ranking pipeline, since this app has no live ranking system.
`.trim(),
};
