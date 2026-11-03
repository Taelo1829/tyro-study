# Tyro Study: Code review and quality assurance

*Phase 7 of the project lifecycle. Written 29 October 2026. This phase was carried out, not only planned: the whole codebase (≈300 source files) was linted, type-checked, tested, built, audited for vulnerable dependencies and scanned for security issues, and today's pending changes were code-reviewed. Problems that were safe to fix now were fixed.*

---

## 1. Results at a glance

| Check | Before | After | How |
|---|---|---|---|
| **Lint** (ESLint, Next.js rules) | 646 errors, 743 warnings, almost all in generated code; **8 real errors** | **0 errors**, 21 warnings | Ignored generated `src/prisma` and `public`; fixed the 8 errors |
| **Type check** (`tsc --noEmit`, whole project) | 0 errors | 0 errors | – |
| **Tests** (Vitest) | 28 passing | **44 passing** (7 files) | Added SSRF-guard tests |
| **Production build** (`next build --turbopack`) | – | **Passes** (81 pages) | Built with placeholder env vars; Google Fonts mocked because the build machine has no internet access |
| **Dependency audit** (`npm audit`) | 39 advisories (6 critical, 19 high) | 30 (1 critical, 18 high) | Patch updates for NextAuth, the Prisma adapter, sanitize-html; Vitest 3 → 4 |
| **Security scan** | – | 2 real issues found, both fixed | Route-by-route auth scan, raw SQL, HTML injection, server-side fetches |
| **Code review** of the pending analytics PR | – | 1 issue fixed, 2 noted | Section 4 |

**Lint is now clean, so CI can block on it.** The updated workflow in `docs/setup/github/workflows/ci.yml` makes lint a required step.

---

## 2. What was changed in this phase

| File | Change | Why |
|---|---|---|
| `src/lib/push-endpoint.ts` (+ test) | New allowlist of browser push services | **Security fix (SSRF):** see 3.1 |
| `src/app/api/push/subscribe/route.ts` | Rejects endpoints that aren't push services; caps key lengths | SSRF |
| `src/lib/web-push.ts` | Refuses to send to non-push URLs, even for rows already stored | SSRF, defence in depth |
| `src/app/api/events/route.ts` | Refuses bodies over 4 KB (413) | Stops the public analytics endpoint being used to bloat the database |
| `eslint.config.mjs` | Ignores `src/prisma/**` and `public/**` | Generated code; 1,370 false alarms |
| `admin/chapters/[id]/page.tsx`, `…/quiz/page.tsx` | First load fetches inside the effect and ignores late replies after unmount | React rule `set-state-in-effect`; avoids state updates on unmounted pages |
| `api/modules/[id]/textbook-upload/route.ts` | Renamed a variable called `module` to `mod` | Next.js rule: `module` is reserved in bundles |
| `components/chat/chat-layout.tsx`, `hooks/use-pusher.ts` | `any` → `LucideIcon` / `unknown` | Type safety |
| `components/chat/voice-recorder.tsx` | Decorative waveform heights no longer use `Date.now()` / `Math.random()` during render | React purity rule; avoids hydration mismatches |
| `components/ui/input.tsx` | Empty interface → type alias | Lint rule |
| `package.json`, `package-lock.json` | `next-auth` 4.24.15, `@auth/prisma-adapter` 2.11.3, `sanitize-html` 2.18.1 (patch updates); `vitest` 4.1.12 | Security advisories (section 5) |
| `docs/setup/github/` | CI (lint now blocking, audit job), **CodeQL** static analysis, **Dependabot** | Move into `.github/` (section 8) |
| `docs/qa/code-review-checklist.md` | The checklist every PR is reviewed against | Section 6 |
| `docs/qa/regression-checklist.md` | Smoke and full regression checks per area | Section 7 |

---

## 3. Security review

### 3.1 Fixed: server-side request forgery through push subscriptions (high)

`POST /api/push/subscribe` stored any `endpoint` URL the browser sent, and `src/lib/web-push.ts` later **POSTs to that URL from the server** whenever a notification goes out. A signed-in user could register an internal or arbitrary address (for example a cloud metadata address) and make Tyro's server send requests to it.

**Fix:** endpoints must be `https`, without credentials or a custom port, on a known push service (`fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`, `*.push.apple.com`, …). Checked on subscribe and again before every send. 16 tests cover accepted services and rejected look-alikes, metadata addresses, `localhost`, `http`, odd ports and non-strings.

### 3.2 Fixed earlier today: admin credentials in Git (high)

See `06-development-and-version-control.md` §5.1. **Rotate that password** if the account exists on the live site.

### 3.3 Checked and fine

| Area | Result |
|---|---|
| Routes without auth | All 15 flagged by the scan are intentional: sign-up, password reset, NextAuth, the public VAPID key, two disabled endpoints that return 410, and profile routes that use `requireUserId()` |
| Raw SQL | No `$queryRawUnsafe`. `Prisma.raw` only in the analytics report, with constant column names |
| HTML injection | Lesson HTML goes through `sanitize-html` (server) and an allowlist sanitizer (client) before `dangerouslySetInnerHTML` |
| Quiz integrity | Answers marked on the server; typed-answer solutions never sent to the browser |
| Pusher channels | Only `presence-online`, the user's own channel and conversations they belong to are authorised |
| Server fetches | Admin-only sources (uploaded PDFs on Vercel Blob, Wikimedia Commons diagrams, the YouTube API, UNISA pages checked by `isUnisaUrl`) or the new push allowlist |

### 3.4 Open security items

| # | Item | Severity | Action |
|---|---|---|---|
| SEC-1 | **Next.js 16.2.6** has a critical advisory (server actions SSRF, image optimisation DoS, dev-server info leak), fixed in 16.4.x | High | Upgrade `next` and `eslint-config-next` to 16.4.3 in their own PR, then run the full regression checklist |
| SEC-2 | `/api/events` is public and not rate-limited (now size-capped) | Medium | Rate limit per IP/visitor with the same store as the sign-in limiter (TS-008) |
| SEC-3 | Sign-in has no rate limit | Medium | TS-008 (already in Sprint 2) |
| SEC-4 | `xlsx` (SheetJS) 0.18.5 has prototype pollution and ReDoS advisories and no fix on npm | Medium (admin uploads only) | Replace with `exceljs`, or install SheetJS 0.20.x from its own CDN as their docs describe |
| SEC-5 | Textbook upload returns raw error messages (admin only) | Low | Return a generic message; log the detail |
| SEC-6 | Chat media are public Blob URLs | Low | Private blobs with signed links (TS-046) |

---

## 4. Code review: pending PR `feat/analytics-events`

Reviewed against `docs/qa/code-review-checklist.md`.

| # | Finding | Severity | Resolution |
|---|---|---|---|
| R1 | `/api/events` accepted any body size from anyone | Medium | **Fixed:** 413 over 4 KB. Rate limit is SEC-2 |
| R2 | `track()` read the visitor cookie inside `after()`, which runs after the response | Low | **Fixed before review:** the cookie is read while the request is still active |
| R3 | `module_joined` does a lookup before the upsert, which can race with a double-click and miss one event | Low | Accepted: an analytics count, not data |
| R4 | Page views fire twice in development (React Strict Mode) | Info | Production only fires once; admin activity is excluded anyway |
| R5 | Analytics SQL scans the whole events table | Info | Fine until about a million rows; then a nightly rollup (noted in the architecture doc) |

**Verdict: approve** once R1 is in (done). The PR now passes lint, type check, tests and build.

---

## 5. Dependency vulnerabilities

| Package | Severity | Used for | Status |
|---|---|---|---|
| `next-auth`, `@auth/prisma-adapter` | Critical | Sign-in | **Fixed** (4.24.15 / 2.11.3) |
| `sanitize-html` | Moderate | Lesson HTML | **Fixed** (2.18.1) |
| `vitest`, `tinypool` | Critical (dev only) | Tests | **Fixed** (Vitest 4.1.12) |
| `next` | Critical | Framework | **Open:** upgrade to 16.4.3 (SEC-1) |
| `prisma` (CLI) and its deps (`hono`, `mysql2`, `valibot`, `deepmerge-ts`) | High (CLI tooling) | Migrations | Open: update Prisma to the latest 7.x when it clears the advisories; not in the runtime path |
| `xlsx` | High | Admin Excel import | Open (SEC-4) |
| `next-pwa` → `workbox-build`, `serialize-javascript`, `rollup-plugin-terser` | High (build time) | Service worker | Open: `next-pwa` is unmaintained; move to `@serwist/next` (maintained successor) |
| `sharp`, `postcss`, `undici`, `brace-expansion`, `js-yaml`… | High (transitive) | Build tooling | Clear with the Next.js and Prisma upgrades; re-audit after |

**Policy from now on:** Dependabot opens grouped weekly PRs; patch updates merge when CI is green; minor/major framework updates get a PR of their own plus the regression checklist; `npm audit --omit=dev --audit-level=high` runs in CI and becomes blocking once SEC-1 and SEC-4 are done.

**Install note:** with npm 10, adding Vitest 4 hit an npm bug (`Cannot read properties of null (reading 'edgesOut')`). npm 11 installs cleanly. If `npm install` fails with that message, run `npx npm@11 install`. `npm ci` from the lockfile is unaffected.

---

## 6. Maintainability and performance review

### 6.1 Performance findings

| # | Finding | Impact | Recommendation |
|---|---|---|---|
| P1 | **Finishing a quiz runs 2–3 sequential queries per answered question** (`findFirst` + `update`/`create` on `user_answers`, `src/app/api/quiz/attempt/route.tsx` ~line 699). A 25-question quiz ≈ 50–75 round trips; an 80-question mock exam ≈ 160–240. | Slow "Finish" (seconds) on Neon, worst at exam time | One `findMany` for existing answers, then `createMany` + a single `UPDATE … FROM (VALUES …)`, in a transaction |
| P2 | Chapter quiz lookups search `quiz_attempts.settings` with `LIKE` | Slower progress pages as attempts grow | Schema gap S2: real `kind` / `chapterId` columns with an index (TS-035) |
| P3 | Public notes pages render on every request (`force-dynamic`) | Slower SEO pages, more DB load | ISR with revalidate on publish (TS-036) |
| P4 | Chat avatars and images use `<img>` (6 warnings) | Larger downloads on mobile data | `next/image` with sizes, or explicit width/height and `loading="lazy"` |

### 6.2 Maintainability findings

| # | Finding | Recommendation |
|---|---|---|
| M1 | Very large files: `quiz-runner.tsx` (44 KB), the topic page (35 KB), the quiz attempt route (34 KB), `timetable/page.tsx` (32 KB) | Split when next touched: quiz runner into question, feedback and results components; attempt route into `lib/quiz/` (start, answer, finish) with tests |
| M2 | Dead code: `quiz-chapter-page.tsx` and `quiz-topic-page.tsx` in the repo root, `/api/message` and `/api/admin/superuser/claim` (both return 410), `NotificationCenter.ts` (fully commented out), `structure.txt`, two TODO files | Delete in a `chore: remove dead code` PR; move TODOs into the backlog |
| M3 | 21 lint warnings (unused imports and variables) | Clean up alongside M2 |
| M4 | Mixed code style (semicolons, quotes, one 4-space file) | One `chore: format` commit with Prettier after open PRs merge |
| M5 | Generated Prisma client committed in `src/prisma` | Keep for now (ADR 0004); consider generating in CI/build later |

---

## 7. QA process

### 7.1 Pull request review (working solo)

There are no other developers yet, so review uses three layers:

1. **Automated gate (required):** CI on every PR: Prisma validate, lint, type check, tests, build; CodeQL; dependency audit.
2. **Self-review with the checklist:** `docs/qa/code-review-checklist.md`, done on the GitHub diff after a break, not straight after writing. Small PRs (under ~400 changed lines) so they can be reviewed properly.
3. **Second pair of eyes for risky changes:** auth, payments, migrations, chat moderation and anything touching minors get an extra review: an AI review of the diff against the checklist, or a fellow developer when one is available. Record who reviewed in the PR.

When contributors join: add `.github/CODEOWNERS`, require one approving review in branch protection, and keep the checklist.

### 7.2 QA against acceptance criteria

For every backlog item:

1. Before coding: the "Done when" criteria in `business/tracking/backlog.csv` are turned into test cases (Given/When/Then from `02-requirements.md` where they exist).
2. Automated where possible: rules → unit tests; SQL → PGlite integration tests; core journeys → Playwright (planned).
3. Manually on the Vercel preview, on a real phone and on desktop, with the test accounts.
4. Results noted in the PR ("QA: criteria 1–3 pass on Android Chrome and desktop Edge").
5. Anything failing goes back to In progress; anything found that's out of scope becomes a new backlog item.

### 7.3 Regression testing

- **Automated:** the CI suite runs on every PR. Every bug fix adds a test that reproduces the bug first.
- **Manual:** `docs/qa/regression-checklist.md`: a 10-minute smoke test on every release, plus the area sections for whatever the PR touches. The full list runs before framework upgrades (Next.js, Prisma, NextAuth), which is exactly what SEC-1 needs.
- **After release:** watch Sentry (once added) and `/admin/analytics` for drops in the funnel the day after a release.

### 7.4 Bug severity

| Severity | Meaning | Response |
|---|---|---|
| S1 Critical | Data loss, security hole, sign-in or quizzes broken for everyone | Hotfix now; rollback first if needed |
| S2 Major | Core flow broken for some, no workaround | Fix this sprint |
| S3 Minor | Workaround exists or cosmetic in a core flow | Backlog, prioritised |
| S4 Trivial | Cosmetic | Backlog |

---

## 8. To do now

1. **Move the GitHub files into place** (they can't be written to `.github` remotely):
   ```powershell
   robocopy docs\setup\github .github /E /MOVE
   ```
   This adds CI (lint now blocking), CodeQL, Dependabot and the PR template.
2. **Install and verify locally:**
   ```bash
   npx npm@11 install   # or npm install
   npm run lint && npm run typecheck && npm test && npm run build
   ```
3. **Commit** the phase-7 changes on their own branch after the analytics and dev-setup PRs (commands in `06-…` §9), for example:
   ```bash
   git switch -c fix/security-and-lint
   git add src/lib/push-endpoint.ts src/lib/push-endpoint.test.ts src/lib/web-push.ts src/app/api/push/subscribe src/app/api/events \
     eslint.config.mjs "src/app/(dashboard)/admin/chapters" "src/app/api/modules/[id]/textbook-upload" \
     src/components/chat src/components/ui/input.tsx src/hooks/use-pusher.ts package.json package-lock.json docs/qa .github
   git commit -m "fix(security): restrict push endpoints to browser push services" \
     -m "Prevents SSRF through user-supplied push subscription URLs. Also: size cap on /api/events, lint errors fixed and lint made blocking, patch updates for next-auth, the Prisma adapter and sanitize-html, Vitest 4, CodeQL and Dependabot."
   ```
4. **Add to the backlog** (Sprint 2–3): SEC-1 Next.js upgrade (P1), SEC-2 events rate limit (P2), SEC-4 replace `xlsx` (P2), P1 batch quiz-finish writes (P1), M2 remove dead code (P3), next-pwa → Serwist (P3).
