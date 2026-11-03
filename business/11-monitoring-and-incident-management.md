# Tyro Study: monitoring and incident management

*Phase 11 of the project lifecycle. Written 30 October 2026. Tyro runs on Vercel Hobby, where runtime logs are kept for **1 hour**, there are no latency percentiles or alerts, and cron jobs run at most once a day. So this phase builds the monitoring Tyro needs into the app and the repo, at no extra cost, and adds one free external uptime monitor. Everything below was built and tested against a production build here; the accounts and secrets in §9 are yours to set up.*

---

## 1. Summary

| Requirement | What's in place |
|---|---|
| **Errors** | Every unhandled server error (`src/instrumentation.ts`), every error a route catches itself (38 `console.error` sites now call `captureError`), and browser crashes and uncaught errors (`instrumentation-client.ts`, error pages) are **grouped** in our own `error_events` table, like an error tracker: one row per bug, with a count, route, request id and first/last seen. Admin → Monitoring lists them, with a Resolved button; a resolved bug reopens if it comes back |
| **Latency** | Real-user Core Web Vitals (LCP, INP, CLS, FCP, TTFB) from half of all page loads, as p75 per metric and per page against targets. Synthetic page timings every hour. Quiz-finish duration logged (the known slow path) |
| **Availability** | External uptime monitor every 5 minutes on `/api/health` (checks the database too), plus the hourly GitHub monitor |
| **Logs, metrics, traces** | Structured JSON logs with level, event, commit and **Vercel request id** (`src/lib/log.ts`), with personal data redacted. The request id links a log line, an error group and a student's report. Full distributed tracing isn't warranted for a single app and database (§5) |
| **Alerts** | Uptime monitor (down) → email and app. GitHub **Production monitor** (hourly: down, slow, reminders stopped, error spike) → an `incident` issue → GitHub email and app notifications, updated as things change and closed on recovery. **Daily ops email** at 06:00 SAST |
| **Scheduled jobs** | Heartbeats: the reminders job records every run, and monitoring alerts if it hasn't succeeded for 30 minutes. That will also show whether anything calls it at all, the open question since phase 4 |
| **Incidents** | Runbook: severities, detection, mitigation (rollback, kill switches), recovering each affected service, POPIA breach steps, fixing the defect; blameless review template |
| **Communicating outages** | `STATUS_MESSAGE` site banner, message templates for WhatsApp and socials, a free public status page from the uptime monitor, an email to affected students for data incidents |

**Also fixed:** a bug from phase 10. The feature flags' `admins` mode compared against `admin`, but roles are stored as `ADMIN`, so "admins only" would have matched nobody. Fixed and covered by tests.

---

## 2. What was tested

| Check | Result |
|---|---|
| A browser error posted twice | **One** group, count 2, page `/modules/[id]` (ids replaced) |
| Bot user agent; 5 KB body | Ignored (204); refused (413) |
| A route crashing on a database error (table renamed for a moment) | Captured by `onRequestError`: grouped with route `/api/modules` and the request id `test::req-…`, and the log line carries the same id |
| A route that catches its own error (forgot-password without email configured) | Captured through `captureError` |
| Reminders job | Heartbeat written; Admin → Monitoring shows "OK, last success 0 min ago" |
| `/api/health` without / with `MONITOR_TOKEN` | Public fields only / plus database latency, error counts, heartbeats |
| Daily digest (`?dry=1`), without the cron secret | Readable summary that lists the new error first / 401 |
| `monitor.mjs`: healthy; reminders never ran; wrong token; database stopped | OK / degraded / degraded ("token not accepted") / **down** (health 503 three times, pages 500) |
| `github-alert.mjs` against a mock GitHub API: ok → degraded → same again → down → ok | No issue → opened #1 → no repeat notification → "Update: down" comment → "Recovered" and closed |
| Admin → Monitoring with sample data, desktop and phone | Renders; no page errors; no sideways scrolling (the errors table scrolls inside its card) |
| Integration tests (PGlite + the real migration): grouping, redaction, resolve/reopen, flood cap (200 new groups/hour), heartbeat failure keeps the last success | Pass |
| All tests, type check, lint, build, smoke test, security tests | 63 tests pass; clean; smoke pass; security 46 pass, 0 new failures, 4 known |

---

## 3. What to watch: service level objectives

| Indicator | Objective | Measured by |
|---|---|---|
| Availability (health 200, database reachable) | **99.5% per month** (≈ 3.6 hours down) | Uptime monitor |
| Real-user page load, LCP p75 | ≤ 2.5 s | Web vitals, Admin → Monitoring |
| Responsiveness, INP p75 | ≤ 200 ms | Web vitals |
| Layout stability, CLS p75 | ≤ 0.1 | Web vitals |
| Key pages (synthetic) | < 3 s, every hour | GitHub monitor |
| Reminders delivered | Job succeeds at least every 30 min | Heartbeat |
| New error types | 0 unexplained per day | Daily email |

**Error budget rule:** if a month misses availability or LCP, the next release is reliability work only (for example, batching the quiz-finish writes, TS-053), not features. Report the month's numbers in the first weekly review of the next month.

---

## 4. Monitoring in detail

### 4.1 Errors (`error_events`)

- **Grouping:** the fingerprint is the error type plus the message with ids, numbers and quoted values stripped, plus the route. "Topic cm1… not found after 3 tries" and "Topic cm9… not found after 7 tries" are one group.
- **Privacy:** emails, tokens, `?key=` values and database credentials are redacted before storing or logging. Only error text, route, request id and digest are kept: no form contents, names or answers.
- **Abuse limits:** `/api/client-errors` is public (errors happen before sign-in), so bodies are capped at 4 KB, bots are ignored, it always answers 204, and at most **200 new groups per hour** are stored; repeats only bump counts.
- **Noise filtered in the browser:** extension and ad-script errors, cross-origin "Script error.", offline/network failures, ResizeObserver warnings. At most 5 reports per page load.
- **Students see** a friendly "Something went wrong — your progress is saved" page with a reference code (the digest), instead of a blank screen.

### 4.2 Latency and performance

| Signal | Source | Where |
|---|---|---|
| Real-user LCP, INP, CLS, FCP, TTFB | `web_vital` events from 50% of page loads (`src/components/monitoring/web-vitals-reporter.tsx`) | Admin → Monitoring (p75, slowest pages), daily email |
| Key page response times | GitHub monitor, hourly | `incident` issue when slow twice in a row |
| Quiz finish duration | `quiz.finished` log line (warns above 3 s) | Vercel → Logs |
| Function duration and errors | Vercel → Observability (Hobby: totals only, 12-hour retention) | Vercel dashboard |
| Database | `dbMs` in the health details; Neon → Monitoring | Monitor alerts above 1 s |

### 4.3 Logs and request ids

All new server logging is one JSON object per line (`level`, `event`, `time`, `env`, `commit`, `requestId`, fields, redacted `error`). Vercel → Logs can filter on these fields. The **Vercel request id** (`x-vercel-id`) is stored with each error group, so: an error in Admin → Monitoring → its request id → that request's log lines in Vercel (within the hour). Vercel Hobby keeps logs for **1 hour**; that's why errors and heartbeats are also stored in the database. If longer log history is ever needed: Vercel Pro (1 day, or 30 days with Observability Plus) or a log drain.

### 4.4 Availability and scheduled jobs

- **Uptime monitor** (set up in §9): UptimeRobot's free plan checks every 5 minutes, with 50 monitors and one status page, and its terms allow commercial use. Monitor `https://www.tyrostudy.co.za/api/health` with keyword `"ok":true` (so a 200 with a database error still alerts), plus the home page. Better Stack's free plan (3-minute checks, 10 monitors) is the alternative.
- **Heartbeats** (`app_heartbeats`): `cron:reminders` must succeed every 30 minutes (`REMINDERS_STALE_MINUTES`) and alerts even if it has *never* run; `cron:daily-digest` every 26 hours.

### 4.5 Alerts

| Alert | Trigger | Channel | Noise control |
|---|---|---|---|
| Site down | Health fails | Uptime monitor → email (and its app) | The provider's own confirmation |
| Down / degraded | Health fails 3× over 40 s, a key page fails twice, a page is slow twice, reminders late, ≥ 5 new error types in an hour, database > 1 s | GitHub issue labelled `incident` | One issue per incident; comments only when the problems change; closed automatically on recovery |
| Daily summary | Every day 06:00 SAST (Vercel cron, within the hour) | Email to `OPS_EMAIL` | One email; subject says "needs attention" or "all quiet" |
| Provider limits | Usage, billing, outages | Vercel / Neon / Resend / OpenAI emails | Turn on usage alerts in each dashboard |

**Why GitHub issues:** free, already on your phone through the GitHub app, and each incident gets a timeline that becomes the review. The hourly schedule keeps a private repository well inside the free Actions minutes; on a public repository it can run every 15 minutes.

---

## 5. Distributed tracing: not now

Tyro is one Next.js app and one database, with a few outbound calls (Pusher, Resend, OpenAI, Blob). A request id on every log line and error, plus timing logs (`timed()` in `src/lib/log.ts`) around slow calls, covers what tracing would show today. Revisit when one of these happens:
- module group chats add background fan-out (many messages, many subscribers);
- work moves to queues or a second service;
- Tyro moves to Vercel Pro, where OpenTelemetry (`@vercel/otel`) traces can go to Observability or to a tracing tool (Sentry, Grafana Cloud) with real retention.

Sentry's free plan (5,000 errors a month, one user) would replace the home-grown error grouping if Tyro outgrows it. The `captureError` and `onRequestError` call sites stay the same; only `src/lib/monitoring.ts` would change.

---

## 6. Incident management

Full runbook: **`docs/runbooks/incident-response.md`**. In short:

| Sev | Example | Respond | Tell students |
|---|---|---|---|
| SEV1 | Site down, sign-in or quizzes broken, wrong student's data, any data exposure | Now (06:00–23:00) | Within 30 min |
| SEV2 | Reminders or sign-up codes not working, chat down, very slow | Same day | If it lasts more than 1 hour |
| SEV3 | Minor bug, few students | Next release | No |

During exam weeks, a SEV2 that blocks studying is treated as a SEV1.

**Steps:** acknowledge in the `incident` issue → scope (health, Admin → Monitoring, recent releases, provider status pages) → **mitigate first** (Instant Rollback, `FLAG_*` kill switches, `SECURITY_HEADERS=off`, Neon compute) → communicate → verify (smoke test, errors stop growing) → recover affected data and jobs → review within 3 days (`docs/incidents/TEMPLATE.md`, blameless, actions into the backlog, a regression test for every production defect).

**Recovering affected services** (all in the runbook): reminders are sent up to 2 hours late and then skipped, so they don't arrive at 2 a.m. for yesterday; quizzes resume, and stuck mock exams are found with the monitoring SQL; codes can be re-requested; chat messages are stored and reappear; damaged data uses the Neon backup branch or restore. On the Free plan, restore only reaches back **6 hours**, so data problems are SEV1.

**Personal data incidents:** contain, preserve evidence before the 1-hour log window closes, assess, and **notify the Information Regulator and affected students as soon as reasonably possible** (POPIA s22). Use a private channel; never put personal data in a GitHub issue.

---

## 7. Communicating outages

| Channel | Use for | How |
|---|---|---|
| Site banner | Degraded service while the site works | `STATUS_MESSAGE` (and `STATUS_LEVEL=info`) in Vercel Production → redeploy (~2 min); remove when resolved |
| WhatsApp groups / socials | SEV1, and SEV2 over an hour | Templates in the runbook: started / update / resolved, each with a time for the next update |
| Status page | Anyone checking whether it's just them | The uptime monitor's free public page (on the provider's address) |
| Email | Data incidents; lost work | Only affected students; plain explanation and what they can do |

---

## 8. Data and privacy

The new tables hold no personal data beyond what logs already had, and less: error messages are redacted, `error_events` stores route templates instead of full paths, and web vitals carry a route template, not query strings. Retention: error groups and heartbeats are small (one row per bug or job). Add them to the retention job planned in business/08 §6.1 (delete error groups not seen for 90 days). The Privacy Policy already covers diagnostics; its "analytics" section should mention performance measurements in one line at the next update.

---

## 9. Setup (about 30 minutes)

1. **Migration** `20261030090000_observability` ships with the next release (additive; two new tables).
2. **Vercel → Production variables:** `MONITOR_TOKEN` (`openssl rand -hex 32`), `OPS_EMAIL` (your address), and check `CRON_SECRET` is set (it protects both cron routes; Vercel Cron sends it automatically).
3. **GitHub:** move the workflows in as before (`robocopy docs\setup\github .github /E /MOVE`); add secret `MONITOR_TOKEN` (same value) and variable `PRODUCTION_URL`. Run **Production monitor** once by hand (Actions → Run workflow). Turn on GitHub mobile notifications for issues.
4. **UptimeRobot** (free): keyword monitor on `https://www.tyrostudy.co.za/api/health` for `"ok":true`, an HTTP monitor on the home page, both every 5 minutes; install the app; create the public status page and pin its link in the WhatsApp groups.
5. **Reminders scheduler:** if nothing calls `/api/cron/reminders` yet, add a cron-job.org job every 5 minutes with header `Authorization: Bearer <CRON_SECRET>`. After a day, Admin → Monitoring should show `cron:reminders` OK.
6. **Provider alerts:** Vercel usage notifications, Neon usage emails, a monthly spend limit on OpenAI, Resend bounce alerts.
7. After the first day: read the daily email, open Admin → Monitoring, and resolve any error groups that are expected.

---

## 10. Files added or changed

| File | Purpose |
|---|---|
| `prisma/migrations/20261030090000_observability/` | `error_events`, `app_heartbeats` |
| `src/lib/log.ts` | Structured logger, redaction, request id, `timed()` |
| `src/lib/monitoring.ts` | Error grouping, `captureError`, heartbeats, summaries |
| `src/lib/route-template.ts` | Page paths → templates (client-safe) |
| `src/lib/ops-report.ts` | Web vitals p75, activity, heartbeat status, daily email text |
| `src/instrumentation.ts`, `src/instrumentation-client.ts` | Server error hook; browser global handlers |
| `src/lib/report-client-error.ts`, `src/app/api/client-errors/route.ts` | Browser error reporting |
| `src/app/error.tsx`, `src/app/global-error.tsx` | Friendly crash pages that report the error |
| `src/components/monitoring/*` | Web vitals reporter, status banner, Resolved button |
| `src/app/(dashboard)/admin/monitoring/page.tsx`, `src/app/api/admin/errors/[fingerprint]/resolve/route.ts`, admin home link | Admin → Monitoring |
| `src/app/api/cron/daily-digest/route.ts`, `vercel.json` | Daily ops email (Vercel cron 04:00 UTC) |
| `src/app/api/health/route.ts` | Token-protected details |
| `src/app/api/cron/reminders/route.ts` | Heartbeat and structured logs |
| `src/app/api/quiz/attempt/route.tsx` | Quiz-finish timing log |
| 33 API route files | `console.error` → `captureError` |
| `src/lib/analytics-shared.ts`, admin analytics labels | `web_vital` event |
| `src/lib/flags.ts` (+ test) | Admin role fix |
| `scripts/ops/monitor.mjs`, `scripts/ops/github-alert.mjs`, `docs/setup/github/workflows/monitor.yml` | Hourly monitor and issue alerts |
| `scripts/qa/security-tests.mjs`, `scripts/ci/check-env.mjs`, `.env.example` | New public routes and variables |
| `src/lib/log.test.ts`, `test/integration/monitoring.test.ts` | 12 new tests |
| `docs/runbooks/incident-response.md`, `docs/incidents/TEMPLATE.md` | Incident process |

---

Sources:
- [Vercel: Observability limits (Hobby runtime logs 1 hour)](https://vercel.com/docs/observability/limits-and-pricing)
- [Vercel: Cron jobs usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Next.js: instrumentation and onRequestError (docs bundled with next 16.2)](https://unpkg.com/next@16.2.1/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md)
- [UptimeRobot alternatives: free plans compared (Product Compass)](https://www.productcompass.pm/p/uptimerobot-alternatives)
- [Sentry free plan 2026 (CostBench)](https://costbench.com/software/developer-tools/sentry/free-plan/)
