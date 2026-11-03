# Tyro Study: production release

*Phase 10 of the project lifecycle. Written 29 October 2026. This is the plan for **v1.0.0**, the first release through the pipeline from phase 9. I can't press the button: approvals, the Vercel/Neon/GitHub setup and the release itself need your accounts. Everything that could be built and tested ahead of the day is in the repo and was run against a production build here. The day-of checklist to fill in is `docs/release/v1.0.0.md`.*

---

## 1. Summary

| Requirement | How v1.0.0 meets it |
|---|---|
| **Approvals** | Six gates: CI green, staging verified, migration baseline, **POPIA decision on high school sign-ups**, rollback readiness, product owner go/no-go. The GitHub `production` environment enforces the approval in the workflow (§2) |
| **Release window** | **Tue 3 Nov 2026, 06:00–07:15 SAST**, fallback Wed 4 Nov. Before work, outside study peaks, no matric paper that day; confirm with the traffic query (§3) |
| **Staged rollout / feature flags** | New `src/lib/flags.ts` (on / off / admins / percentage). Flags: `highschool_signup` (POPIA), `analytics` (kill switch). HSTS rolled out in stages. Staging → production; Vercel Rolling Releases noted for Pro (§4) |
| **Verify migrations and health** | Baseline check before; workflow backs up, migrates, then `/api/health` must report the release commit **and** the newest migration (§5) |
| **Smoke tests** | Automated: 10 HTTP checks + 3 headers + migration + flags. Manual: 10-minute phone script. Monitoring queries at T+15/30/60 minutes and at the first evening peak (§6) |
| **Rollback / recovery readiness** | Checklist, explicit triggers, kill switches, list of what a rollback can't undo, Neon restore rehearsal on staging (§7) |

**Built and tested for this phase:** feature flags (7 new tests, 51 total pass), register page and API respecting `highschool_signup`, analytics kill switch, staged HSTS, flags in `/api/health`, migration check in the smoke test, release preflight script, monitoring SQL. Tested both flag states against a production build:

| Check | Flags default | `FLAG_HIGHSCHOOL_SIGNUP=off`, `FLAG_ANALYTICS=off` |
|---|---|---|
| `/api/health` flags | `highschool_signup: on, analytics: on` | `off, off` |
| Register page | Shows "High school (Grade 11 and 12 subjects)" | Shows only university, plus the paused message |
| `POST /api/auth/register` with level high school | Accepted (503 here only because email sending isn't configured locally) | **403** with the paused message |
| Analytics event | Row written | **No row, no cookie** |
| HSTS | `max-age=86400; includeSubDomains` | same |

Plus: smoke test 10/10 with the migration check, security tests 46 pass / 0 new failures / 4 known, type check and lint clean.

---

## 2. Approvals

v1.0.0 has no new student-facing features (security fixes, analytics, health check, flags, pipeline), so the gates are about safety, not feature acceptance. Full UAT (business/08 §9) applies from milestone M1 in December.

| Gate | Who | What counts as approval |
|---|---|---|
| A1 CI green | Automatic | `check` job passed on the release commit; the workflow refuses otherwise |
| A2 Staging verified | Taelo | `preflight.mjs` says GO; 10-minute phone check on staging |
| A3 Migration baseline | Taelo | `prisma migrate status` on production is clean (first release only) |
| A4 **POPIA: high school sign-ups** | Taelo (product owner, also the default Information Officer) | `FLAG_HIGHSCHOOL_SIGNUP` value chosen and reason written down |
| A5 Rollback ready | Taelo | §7 checklist ticked |
| A6 Go / no-go | Taelo | Signed in `docs/release/v1.0.0.md`, then the approval click in GitHub |

**Recommendation for A4: `off`.** POPIA requires a competent person's prior consent before processing a child's personal information (business/08 §6.2). Turning the flag off stops *new* under-18 sign-ups today, without a code change, until the parental consent flow (TS-054) exists. Existing high school learners keep their access; the consent flow should also ask them for a parent's confirmation when it ships. Choosing `on` is a business decision to accept the risk for a while; if so, write the reason and the date by which consent will exist. *This is not legal advice.*

Solo approver: you approve your own release. That's acceptable at this size because the workflow still enforces CI, the backup and the checks; add a second reviewer to the `production` environment when someone joins.

---

## 3. Release window

| Factor | Finding |
|---|---|
| UNISA | The October/November 2026 exam period started on 29 September; students are in exams and revising |
| Grade 12 learners | NSC finals run from 13 October to 26 November 2026. Monday 2 November has Physical Sciences P2; **Tuesday 3 and Wednesday 4 November have no papers** |
| Tyro traffic | Students study in the evenings and at weekends; quiz load peaks 18:00–23:00 (phase 8 load test assumptions). Early weekday mornings should be the quietest |
| You | You work during the day, so a mid-morning release isn't realistic; 06:00 gives about an hour of close watching before work |
| Rollback windows | Neon Free restores data up to 6 hours back, so the morning release leaves the whole working day to spot a data problem before the evening peak |

**Window: Tuesday 3 November 2026, 06:00–07:15 SAST.** Fallback: Wednesday 4 November, same time. **Confirm it** with query 1 in `docs/release/monitoring.sql` (answers per weekday and hour over 28 days): if 06:00 isn't among the quietest hours, pick the quietest one you can watch for an hour.

**Rules from now until 26 November (exam season):**
- Only security fixes and bug fixes go out; features wait for 27 November or later.
- No releases 17:00–23:00 SAST, on Fridays, or the night before a large exam.
- Releases are small (Hobby Instant Rollback covers only the previous deployment).

---

## 4. Staged rollouts and feature flags

### 4.1 Stages for every release

1. **CI** (throwaway database) → 2. **PR preview** → 3. **Staging** with test accounts (`main`) → 4. **Production**, with a flag set to `admins` first when the change is risky → percentage → everyone.

### 4.2 Feature flags (`src/lib/flags.ts`)

One environment variable per flag, `FLAG_<NAME>`, set in Vercel per environment. A change applies after a redeploy (about 2 minutes, no code change).

| Value | Who gets the feature |
|---|---|
| `on` / `off` | Everyone / no one |
| `admins` | Admins and superusers only: try it in production on real data first |
| `25%` | A stable 25% of signed-in users (the same users each time; raising the percentage only adds users), plus admins |

| Flag | Default | Use in v1.0.0 |
|---|---|---|
| `highschool_signup` | on | Pause new high school sign-ups (register page, register API, profile level switch). Existing learners unaffected |
| `analytics` | on | Kill switch: stops writing events and setting the visitor cookie if analytics misbehaves or a privacy question comes up |

The current settings show in `/api/health` (`flags`), so the release check confirms them. **Planned flags:** `module_group_chats` (ADR 0007): `admins` → 10% → 50% → on, with one-to-one chat kept until the groups are stable; future AI features (cost control). Remove a flag once its feature is permanently on.

### 4.3 Staged security changes

- **HSTS** is the one change a rollback can't take back: browsers remember it for `max-age` seconds. It now starts at **1 day** and is raised with `HSTS_MAX_AGE` (no code change): 1 day (v1.0.0) → 1 year after a week without HTTPS problems on any `tyrostudy.co.za` subdomain → 2 years, then optionally `HSTS_PRELOAD=1` and a preload submission.
- `SECURITY_HEADERS=off` removes all security headers in an emergency (redeploy to apply).
- The full script/style CSP stays a later, report-only trial (business/08 §3.3).

### 4.4 Platform-level staged rollout

Vercel **Rolling Releases** send a percentage of visitors to the new deployment before promoting it, with metrics compared side by side, but they're on **Pro and Enterprise only** and need Skew Protection. On Hobby, the flags above are the staged rollout. Consider Pro when group chats launch (more risk, more traffic), together with longer Instant Rollback history and cron jobs every few minutes.

---

## 5. Verifying database migrations and service health

| When | Check | Tool |
|---|---|---|
| Before (once) | Prisma's history matches production: `npx prisma migrate status` (read-only) clean, or baseline with `migrate resolve --applied` | docs/runbooks/migrations.md |
| Before | Staging runs `main` on the newest migration | `preflight.mjs` (reads staging `/api/health`) |
| During | Backup branch `pre-v1.0.0` created; `migrate status` printed; `migrate deploy` succeeds **before** the code changes | Release workflow, migrate job |
| During | `/api/health` reports the release commit **and** the newest migration in the repo; flags printed | Release workflow, verify job (`EXPECT_MIGRATION`) |
| After | `_prisma_migrations` shows the new rows, finished and not rolled back | `monitoring.sql` query 7 |
| After | The new table is used: analytics events arriving | `monitoring.sql` query 5 |
| Ongoing | Uptime monitor on `/api/health` (UptimeRobot / Better Stack free), alert to your phone | business/09 §8 step 15 |

---

## 6. Smoke tests

**Automated** (`scripts/ci/smoke.mjs`, run by the workflow; read-only, safe on production):
- Waits for the new commit, checks the newest migration, prints the flags.
- `/`, `/notes`, `/login`, `/register`, `/privacy`, `/api/modules`, `/api/push/public-key` → 200.
- `/dashboard` signed out → redirect to sign-in. `/api/progress/modules` and `/api/topics?chapterId=…` signed out → 401 (the lesson-text fix from phase 8 stays fixed).
- HSTS, `X-Content-Type-Options` and CSP headers present.

**Manual** (10 minutes on a phone with the test account, `docs/release/v1.0.0.md` §4.2): sign in, lesson, quiz (answer, feedback, finish), timetable reminder, chat message, profile, sign out, register page matches the A4 decision, admin analytics shows today's events.

**Monitoring after go-live** (`docs/release/monitoring.sql`, read-only): answers and active students since the release vs the same hour last week (query 2–3), quizzes stuck in progress (4), analytics arriving (5), sign-ups by level (6). Run at T+15, T+30 and T+60 minutes, at lunch, and during the first evening peak, together with Vercel → Observability for errors and `/api/quiz/attempt` duration (the slow quiz finish from business/08 §7.2 shows up there first).

---

## 7. Rollback and recovery readiness

| Item | Status before go |
|---|---|
| Code rollback | Vercel Instant Rollback to the deployment before v1.0.0 (preflight prints its commit). Seconds. Afterwards: Undo Rollback / promote to re-enable auto-assignment |
| Data recovery | Neon backup branch `pre-v1.0.0` (made by the workflow) and the 6-hour restore window (Free plan) |
| Rehearsal | Restore the **staging** branch to 30 minutes earlier once, timed, before release day |
| Kill switches | `FLAG_ANALYTICS=off`, `FLAG_HIGHSCHOOL_SIGNUP=off`, `SECURITY_HEADERS=off` (redeploy) |
| Triggers | Health down more than 2 min; sign-in broken; quizzes can't be answered or finished; more than 1% 5xx for 5 min; wrong or other students' data shown (`v1.0.0.md` §3) |
| Can't be undone by rollback | HSTS (1 day, hence the staged rollout), the new service worker until refreshed, emails sent, cookies set, additive schema (harmless) |
| Who decides | Taelo; roll back first, investigate after. Personal data exposed → POPIA breach steps (business/08 §6.1) |

---

## 8. Communication

| Audience | When | What |
|---|---|---|
| Students | Before | Nothing needed: no visible change except pinch-zoom (and the paused message on the register page if A4 = off) |
| Students | After | Optional: the changelog "For students" lines in a WhatsApp/social post; no in-app announcement needed |
| Students | If something breaks | Short message on the channels you use (WhatsApp groups, socials): what's affected, that you're on it, when to try again |
| Record | After | GitHub release v1.0.0 (automatic), `docs/release/v1.0.0.md` filled in |

---

## 9. After the release

- **T+1 day:** error log, monitoring queries, student reports.
- **T+7 days:** raise `HSTS_MAX_AGE` to 1 year; close the release record with a short retrospective; move follow-ups to the backlog.
- **Next releases (exam season, fixes only):** v1.0.1 Next.js security upgrade (business/07 critical advisory; then make the `audit` CI job blocking); v1.0.2 batch quiz-finish writes (TS-053) before the end of the exam period; TS-054 parental consent, after which `highschool_signup` can return to `on`.

---

## 10. Files added or changed in this phase

| File | Change |
|---|---|
| `src/lib/flags.ts`, `src/lib/flags.test.ts` | Feature flags with percentage rollout; 7 tests |
| `src/app/(auth)/register/page.tsx`, `register-form.tsx` | Page reads the flag on the server; the form hides the high school option when paused |
| `src/components/auth/level-picker.tsx` | Optional `levels` filter; full-width layout with one choice |
| `src/lib/levels.ts` | Paused message shared by the UI and API |
| `src/app/api/auth/register/route.ts`, `src/app/api/profile/route.ts` | Refuse new high school sign-ups / switches when paused (existing learners unaffected) |
| `src/lib/analytics.ts`, `src/app/api/events/route.ts` | Analytics kill switch |
| `next.config.ts` | Staged HSTS (`HSTS_MAX_AGE`, `HSTS_PRELOAD`), `SECURITY_HEADERS=off` switch |
| `src/app/api/health/route.ts` | Reports flag settings |
| `scripts/ci/smoke.mjs` | Migration check (`EXPECT_MIGRATION`), topic-list and header checks |
| `.github/workflows/release.yml` (in `docs/setup/github`) | Passes the newest migration to the verify job |
| `scripts/release/preflight.mjs` | Go/no-go checks before starting the release |
| `docs/release/v1.0.0.md`, `docs/release/monitoring.sql` | Release record and monitoring queries |
| `CHANGELOG.md`, `.env.example` | Flags, staged HSTS |

---

Sources:
- [UNISA: October/November 2026 online exam period starts 29 September 2026](https://www.unisa.ac.za/sites/myunisa/default/Announcements/The-October-November-2026-online-exam-period-starts-on-29-September-2026-Make-sure-youre-prepared-by-using-the-available-support-resources-and-checking-the-latest-invigilator-app-updates)
- [2026 matric exam dates: full NSC timetable (FundiConnect)](https://fundiconnect.co.za/2026-matric-exam-dates)
- [Vercel: Rolling Releases](https://vercel.com/docs/rolling-releases)
- [Vercel: Instant Rollback](https://vercel.com/docs/instant-rollback)
- [Neon: History window](https://neon.com/docs/introduction/history-window)
