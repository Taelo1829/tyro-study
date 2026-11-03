# Tyro Study: maintenance and continuous improvement

*Phase 12 of the project lifecycle. Written 30 October 2026. This phase is the first maintenance cycle itself: the patches and improvements below are in the code and tested, and this document sets up the routine that keeps it going (calendar, technical debt register, feedback loop, monthly metrics review, release roadmap).*

---

## 1. Summary

| Requirement | Delivered this phase |
|---|---|
| **Fix bugs and technical debt** | **Admin pages rendered their data for any signed-in student** (found and fixed); sign-in rate limit (TS-008); sign-up email enumeration (TS-055); feature-flag admin bug (phase 11); a technical debt register with 15 items, 6 closed |
| **Update dependencies, patch vulnerabilities** | Next.js 16.2.6 → **16.4.3** (critical advisory), Prisma 7.8 → 7.10.1, all compatible updates; SheetJS `xlsx` replaced with `exceljs`; two transitive overrides. **Production advisories: 27 (1 critical, 17 high) → 5 low**, all build-time. Dependabot tuned; CI now checks the committed Prisma client |
| **Performance and usability** | Quiz finish: **34 → 16** database round trips for 10 questions and **174 → 16** for 80; locally 259 ms → 35 ms for a mock exam. Accessibility: **46 of 46** page scans now pass WCAG 2.2 AA rules (contrast, link names, focusable regions) |
| **Respond to user feedback** | In-app **Send feedback** (bugs, lesson mistakes, ideas) → **Admin → Feedback** inbox with statuses and notes, counted in the daily ops email; triage rules and response times (§5.2) |
| **Review metrics, plan releases** | Monthly review template (product metrics, SLOs, feedback, maintenance, decisions), maintenance calendar, roadmap v1.0.0 → v1.3.0 (§6) |

**Tests after this phase:** 76 unit and integration tests (13 files) pass; type check, lint and build clean; security tests **53 pass, 0 fail**, 2 known issues (down from 4); smoke test pass; accessibility scan 46/46 clean; exam-rush load test 0 errors.

---

## 2. Patches and dependency updates

### 2.1 What changed

| Package | Before | After | Why |
|---|---|---|---|
| `next`, `eslint-config-next` | 16.2.6 | **16.4.3** (pinned) | Critical: proxy bypass in App Router apps built with Turbopack (Tyro uses both); DoS fixes; patched `postcss`, `sharp` |
| `prisma`, `@prisma/client`, `@prisma/adapter-pg` | 7.8.0 | **7.10.1** | CLI dependencies (`hono`, `mysql2`, `valibot`, `deepmerge-ts`) had high advisories |
| `xlsx` (SheetJS) | 0.18.5 | **removed** → `exceljs` 4.4 | Abandoned on npm; prototype pollution + ReDoS with no npm fix. Admin templates and imports rewritten (`src/lib/excel/workbook.ts`), now reporting real Excel row numbers. `.xls` is no longer accepted |
| `uuid`, `serialize-javascript` | transitive | npm `overrides` → 11.1.1, 7.1.4 | Patched versions for `exceljs` and the PWA build |
| Everything else | – | latest compatible minor/patch (`npm update`) | Routine |

**Not done on purpose:** major upgrades (TypeScript 7, Vitest 5, ESLint 10, Prisma 8 RC, React 19.3) are scheduled one per month on spike branches (§4). The remaining 5 low advisories are in `next-pwa`'s build-time Workbox chain; `next-pwa` is unmaintained and will be replaced by Serwist (TD-03).

### 2.2 One step for you

The generated Prisma client is committed in `src/prisma` and is still 7.8.0, because the Prisma engines can't be downloaded in my environment. On your PC run `npx prisma generate` and commit `src/prisma`. CI now **fails** if the committed client doesn't match the installed Prisma version and schema, so this can't be forgotten. The app ran here with the 7.8.0 client and the 7.10.1 adapter (all tests, security, smoke and load tests passed), so the pair is compatible in the meantime.

### 2.3 Process from now on

`docs/runbooks/dependency-updates.md`: security advisories within 7 days (critical 48 hours), weekly grouped Dependabot PRs for patch/minor (majors ignored, planned instead), monthly audit, and what to do when there's no fix (override, replace, or record why it's not reachable).

---

## 3. Bugs and technical debt fixed

### 3.1 Admin pages showed their data to students (security, fixed)

While adding the feedback inbox, a test showed that a **signed-in student opening `/admin`, `/admin/analytics`, `/admin/monitoring` or `/admin/feedback` received the admin page's content** (HTTP 200). The admin layout redirected non-admins, but Next.js renders a layout and its page in parallel, so the page's data was already in the response. In production today this affects the admin dashboard counts and the analytics report (aggregate numbers, no personal data). Admin **APIs** were never affected: each checks the role (phase 8 tested all 56).

**Fix (two layers):** the proxy now refuses `/admin` unless the session's role is `ADMIN`, and every admin page that loads data calls `requireAdminPage()`, which re-checks the role in the database (so a demoted admin with an old session is refused too). Five new security tests check that each admin page redirects a student without admin content, and that an admin still gets in. The phase 8 permission tests covered API routes only; pages are now in the suite.

### 3.2 Other fixes

| Item | Before | After |
|---|---|---|
| **Sign-in rate limit** (TS-008) | Unlimited password guessing | 8 wrong passwords per email or 60 per network in 15 minutes → HTTP 429 and the message "Too many wrong passwords. Wait 15 minutes…". Stored in Postgres (`rate_limits`, hashed keys, no emails stored), works across all Vercel instances, fails open if the database errors. Campus networks shared by many UNISA students get the higher per-network limit |
| **Sign-up enumeration** (TS-055) | "Email already registered" (409) | Same 202 response as a new sign-up; the account owner gets an email: "you already have an account, sign in or reset your password" (max 2 an hour). The password is hashed first so both paths take the same time |
| **Feature flag `admins` mode** | Matched nobody (roles are `ADMIN`) | Fixed in phase 11; covered by tests |
| **Housekeeping** | – | The daily job now deletes expired rate-limit windows and error groups not seen for 90 days |

### 3.3 Corrections to earlier reports

- **Phase 8 quiz-finish numbers** (335 statements for 80 questions) counted Postgres' internal foreign-key checks, which aren't network round trips. Measured properly (application statements only): **174** for 80 questions before this phase, **16** after.
- **Phase 8 accessibility results** came from a build without the Tailwind/PostCSS config in my test copy, so the "touch target" findings were artefacts of an unstyled page. The real findings with styles loaded were contrast, link names and one focusable region; all are fixed (§4.2).

### 3.4 Technical debt register

`docs/tech-debt.md`: 15 items with impact, priority and target release. Closed in this phase: TD-01 (Next.js), TD-02 (xlsx), TD-04 (admin pages), TD-05 (quiz finish), TD-06 (rate limit, enumeration). Open highlights: TD-03 replace `next-pwa` with Serwist, TD-07 move from raw SQL fallbacks to typed Prisma models, TD-09 level separation (E-11), TD-11 split the 800-line quiz route, TD-12 full CSP.

---

## 4. Performance and usability improvements

### 4.1 Quiz finish (TS-053)

`src/lib/quiz-finish.ts` saves a finished quiz's answer history with one read, one multi-row insert, one multi-row update and one typed-answer update, whatever the length. Same behaviour as before (one history row per question, updated if answered before; newest row wins if there are old duplicates).

| Quiz | Statements before | After | Local time before → after |
|---|---|---|---|
| 10 questions | 34 | 16 | 90 → 80 ms |
| 80 questions (mock exam) | 174 | **16** | 259 → **35** ms |
| 80 questions, all answered before | 174 | 16 | 266 → 49 ms |

On Neon, each statement is a network round trip (~5 ms in-region): roughly 0.9 s → 0.1 s to finish a mock exam, and far more if the function region doesn't match the database. Exam rush, 30 students at once on this 2-CPU test machine: finish p50 **435 ms** for 25 questions, and an 80-question finish now takes about the same as a 25-question one. Single student: start 196 ms, answer 22 ms, finish 62 ms. Absolute numbers depend on the machine; compare on staging with `scripts/qa/load-quiz.mjs`.

### 4.2 Accessibility

| Fix | Detail |
|---|---|
| Muted text contrast | Theme token `--neo-muted` #6b7280 → #5b6270: from 3.9–4.5:1 to 4.9–6.1:1 on white, grey and tinted cards. Fixes the dashboard, module, lesson and quiz pages at once |
| Lesson and policy links | #1d8fd8 (3.5:1) → #0f6fb5 (5.3:1) |
| Calendar days outside the month | Faded to 2.5:1 with opacity → solid grey, 5.4:1 |
| Logo links | Accessible names ("Tyro Study home", "Tyro Study: dashboard") where the text is hidden on phones |
| Scrollable admin tables | Keyboard-focusable regions with labels |

Result: the axe-core WCAG 2.2 A/AA scan is clean on **all 46** page × screen-size combinations (public, student, admin, phone and desktop), including the new feedback, monitoring and admin feedback pages. Manual screen-reader checks (business/08 §8.2) still apply.

---

## 5. Responding to user feedback

### 5.1 The feedback feature

- **Students:** avatar menu → **Send feedback** (also linked from the error page). Choose *Something isn't working*, *A mistake in a lesson or question*, *An idea* or *Something else*, write a message; the page they came from is attached automatically as a route template (`/modules/[id]/topics/[id]/quiz`, no ids). Signed-in only, 5 per hour, 2,000 characters, with a reminder not to include passwords or ID numbers.
- **Admins:** **Admin → Feedback** lists messages with student, page, app version and date; filter by New, Planned, Done, Won't do; set a status and a note (e.g. the backlog id). New feedback is counted in the daily ops email; a `feedback_sent` analytics event records the volume.
- **Tested:** signed out 401; invalid kind 400; valid 201; 7th message in an hour 429; a student can't open the inbox; the admin sees the message with the route template.

### 5.2 How feedback is handled

| Kind | First look | Action | Close the loop |
|---|---|---|---|
| Something isn't working | Within 1 working day (daily email) | Reproduce → backlog item with a regression test → release; SEV1/2 follow the incident runbook | Status Done; if the student asked a question, reply by email |
| Mistake in a lesson or question | Within 2 days | Fix the content the **same week** (no release needed) | Status Done |
| Idea | Weekly | Note themes; scored in the monthly review (§6.1) | Planned / Won't do with a short note |

Other channels (WhatsApp groups, email, socials): copy anything actionable into the inbox so everything is counted in one place. "For students" changelog lines are the public answer to "you said, we did".

---

## 6. Reviewing metrics and planning releases

### 6.1 Rhythm

| When | What | Inputs | Output |
|---|---|---|---|
| Daily (2 min) | Read the ops email | Errors, jobs, activity, feedback | Triage anything new |
| Weekly, Monday (30 min) | Merge Dependabot PRs; triage feedback; check Admin → Monitoring | Dependabot, inbox, monitoring | Backlog updated; content fixes done |
| Monthly, first Monday (60 min) | **Product and maintenance review** (`docs/reviews/monthly-review-template.md`) | Admin → Analytics (30 days), SLOs, feedback, `npm audit`, tech debt | Decisions, next month's releases and top 3 improvements |
| Quarterly | Roadmap review with UAT students | Reviews, retention, UNISA calendar | Next quarter's milestones |

**Prioritising:** (students affected × impact) ÷ effort, with security and data issues first, and the error-budget rule from business/11: a month that misses availability or LCP is followed by a reliability-only release.

### 6.2 Maintenance calendar

| Month | Maintenance focus |
|---|---|
| Nov 2026 | Exam season: fixes only. Release v1.0.0; regenerate the Prisma client; uptime and reminders scheduling working |
| Dec 2026 | v1.1.0 (milestone M1). Spike: React 19.3 + `@types/react` |
| Jan 2027 | v1.2.0. Replace `next-pwa` with Serwist (TD-03); spike: Vitest 5 |
| Feb 2027 | TypeScript 7 spike; TD-07 typed Prisma models |
| Mar 2027 | ESLint 10 + `eslint-config-next`; Prisma 8 once stable |
| Every month | Audit, Dependabot, tech-debt review, monthly review |

### 6.3 Release roadmap

| Version | Target | Contents | Type |
|---|---|---|---|
| **v1.0.0** | Tue 3 Nov 2026, 06:00 (business/10) | Everything from phases 6–12: security fixes (topic list, headers, **admin pages**, rate limit, enumeration), Next.js/Prisma upgrades and xlsx replacement, quiz-finish batching, monitoring, feedback, accessibility, flags, pipeline. Four new tables, all additive | Security + reliability |
| v1.0.x | As needed in November | Hotfixes from monitoring and feedback during exams | Patch |
| **v1.1.0** | 9–11 Dec 2026 (M1 UAT, business/08 §9) | Parental consent for under-18s (TS-054) → `highschool_signup` back on; level separation (TD-09); report-only full CSP (TD-12); feedback-driven fixes; HSTS to 1 year | Minor |
| **v1.2.0** | Feb 2027 (M2) | Serwist PWA (TD-03), quiz route refactor (TD-11), typed models (TD-07), retention job for analytics and chat | Minor |
| **v1.3.0** | Apr 2027 (M4) | Module group chats behind `module_group_chats` flag: admins → 10% → 50% → on; moderation | Minor |

**Why v1.0.0 is larger than planned in phase 10:** nothing has gone through the pipeline yet, and this phase found a security issue in production (§3.1) and a critical framework advisory. Shipping them together, tested on staging, is safer than leaving either for later. Everything new is additive, and the riskier parts have switches (`FLAG_ANALYTICS`, `FLAG_HIGHSCHOOL_SIGNUP`, `SECURITY_HEADERS`). If you'd rather keep v1.0.0 small, release the security branch first as v1.0.0 and the rest as v1.0.1 a week later; both orders work with the expand-only migrations.

---

## 7. Files added or changed

| Area | Files |
|---|---|
| Dependencies | `package.json`, `package-lock.json` (Next 16.4.3, Prisma 7.10.1, exceljs, overrides), `next.config.ts` |
| Excel | `src/lib/excel/workbook.ts` (new), `flashcards.ts`, `questions.ts`, `excel.test.ts` (new), template and import routes, `excel-bulk-import.tsx` |
| Admin page security | `src/lib/admin.ts` (`requireAdminPage`), `src/proxy.ts`, admin home/analytics/monitoring/feedback pages |
| Rate limits | `prisma/migrations/20261030120000_rate_limits/`, `src/lib/rate-limit.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/lib/auth.ts`, login page, `test/integration/rate-limit.test.ts` |
| Sign-up | `src/app/api/auth/register/route.ts` |
| Quiz finish | `src/lib/quiz-finish.ts`, `src/app/api/quiz/attempt/route.tsx`, `test/integration/quiz-finish.test.ts` |
| Feedback | `prisma/migrations/20261030130000_feedback/`, `src/lib/feedback.ts`, `src/app/api/feedback/`, `src/app/api/admin/feedback/[id]/`, `src/app/(dashboard)/feedback/`, `src/app/(dashboard)/admin/feedback/`, `src/components/feedback/*`, avatar menu, error page, admin home, analytics labels, ops email |
| Accessibility | `globals.css`, timetable page, top nav, public shell, analytics and monitoring tables |
| Schema | `prisma/schema.prisma`: models for `error_events`, `app_heartbeats`, `rate_limits`, `feedback` (validated with Prisma's schema validator) |
| Housekeeping | `src/lib/monitoring.ts` (`pruneErrorGroups`), daily digest |
| Tests and CI | `security-tests.mjs` (admin pages, dedicated brute-force address), `known-issues.json` (2 retired), `seed-test-data.mjs`, `a11y-scan.mjs` (6 more pages), `ci.yml` (Prisma client check), `dependabot.yml` |
| Docs | `CHANGELOG.md`, `docs/tech-debt.md`, `docs/runbooks/dependency-updates.md`, `docs/reviews/monthly-review-template.md` |
