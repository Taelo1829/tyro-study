# Changelog

What changed in each production release of Tyro Study. Newest first.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/).

How to use it (docs/runbooks/release.md):
- Every pull request that changes behaviour adds a line under **Unreleased**.
- Before a release, rename **Unreleased** to `## [x.y.z] - YYYY-MM-DD` and add a new empty **Unreleased** above it.
  The release workflow publishes that section as the GitHub release notes and refuses to run without it.
- Write the **For students** lines in plain language; they can be reused in an in-app "What's new" note.

## [Unreleased]

### For students
- You can pinch to zoom on every page again.
- If a page fails, you now see a clear "Something went wrong — your progress is saved" screen with a Try again button.
- You can send feedback from the menu (your picture → Send feedback): report a bug, a mistake in a lesson, or an idea.
- Finishing a quiz, especially an 80-question mock exam, is much faster.
- Text and calendar dates are easier to read (stronger contrast).
- Your study reminders and app pages are protected by stronger browser security settings.

### Added
- Product analytics: sign-up, onboarding, study and quiz events, with an admin report at `/admin/analytics` (ADR 0006).
- `GET /api/health` for uptime monitoring and release checks.
- Automated tests (Vitest + PGlite), CI on every pull request, security, accessibility and load test scripts in `scripts/qa`.
- Release pipeline: staging from `main`, gated production releases with migration backups (ADR 0010).
- Feature flags (`FLAG_*` environment variables, `src/lib/flags.ts`): `highschool_signup` can pause new high school sign-ups; `analytics` is a kill switch. Settings show in `/api/health`.
- Release preflight (`scripts/release/preflight.mjs`) and monitoring queries (`docs/release/monitoring.sql`).
- Feedback: in-app form (`/feedback`) and admin inbox (`/admin/feedback`) with triage statuses; counts in the daily ops email.
- Sign-in rate limit: 8 wrong passwords per email or 60 per network in 15 minutes, then a clear message (TS-008).
- Monitoring: grouped error tracking for server and browser errors, real-user performance (web vitals), job heartbeats, Admin → Monitoring, daily ops email, hourly production monitor with GitHub issue alerts, site status banner (business/11).

### Fixed
- **Security:** admin pages (dashboard counts, analytics, monitoring, feedback) rendered their data for signed-in students, because the admin layout's redirect doesn't stop a page rendering. Admin pages now check the role themselves and the proxy refuses `/admin` for non-admins.
- **Security:** sign-up no longer reveals whether an email has an account; the owner gets an email instead (TS-055).
- **Performance:** finishing a quiz saves the answer history in a fixed 16 statements instead of 2 per question (34 → 16 for 10 questions, 174 → 16 for 80) (TS-053).
- **Accessibility:** muted text, lesson links and other-month calendar days now meet 4.5:1 contrast; logo links have names; scrollable admin tables are keyboard-focusable.
- **Security:** the topic list API returned lesson text for locked and unpublished topics to anyone, without signing in. It now requires sign-in and returns lesson text to admins only.
- **Security:** push notification endpoints are checked against an allowlist (SSRF).
- The quiz API returns 400 instead of 500 for malformed requests.
- The profile picture input has an accessible label.
- Feature flags' "admins only" setting now recognises admin accounts (roles are stored as `ADMIN`).

### Security
- Next.js 16.2.6 → 16.4.3 (critical advisory: proxy bypass in Turbopack builds, and DoS fixes); Prisma 7.8.0 → 7.10.1; compatible updates of all other packages. Production audit: 27 advisories (1 critical, 17 high) → 5 low, all in build-time tooling.
- Replaced the unmaintained SheetJS `xlsx` with `exceljs` for admin Excel templates and imports. Only `.xlsx` files are accepted now (save `.xls` files as `.xlsx`).
- Added HSTS (starting at a 1-day max-age, raised in stages), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and a base Content-Security-Policy; removed `X-Powered-By`.

### Changed
- Privacy Policy describes analytics and the services that process data.
