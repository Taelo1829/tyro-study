# Code review checklist

Use on every pull request before merging. Tick only what you actually checked. Reviewing your own PR: do it after a break, on the PR diff in GitHub (not in the editor), top to bottom.

## 1. Does it do the right thing?
- [ ] The PR links a backlog item and every acceptance criterion is met
- [ ] Behaviour matches the design (`business/design/screens`) or the change is agreed
- [ ] Edge cases from `business/02-requirements.md` §5.3 that apply are handled (no data, locked topic, offline, time zone, level)

## 2. Security
- [ ] Every new or changed route checks the session and role **on the server** (`requireAuth`, `requireAdmin`, `requireUserId`, `canManageAdmins`)
- [ ] Queries are scoped to the signed-in user (no reading or changing another user's data by changing an id)
- [ ] Request bodies are validated (types, lengths, allowed values); nothing from the body decides who the user is
- [ ] No raw SQL built from strings; tagged templates only. `Prisma.raw` only with constants
- [ ] HTML from users or AI goes through the sanitizer before `dangerouslySetInnerHTML`
- [ ] The server never fetches a URL the user controls without an allowlist (SSRF)
- [ ] No secrets, tokens or personal data in code, logs, error messages or analytics
- [ ] Uploads check type and size; files that should be private aren't public

## 3. Data and migrations
- [ ] Migration is additive or safely reversible; tested on a Neon branch
- [ ] Code works before the migration runs (`orFallback`) and after
- [ ] New user data cascades on account deletion, and the Privacy Policy covers it
- [ ] Indexes exist for new queries on large tables

## 4. Maintainability
- [ ] Logic lives in `src/lib`, route handlers stay thin, no copy-pasted blocks
- [ ] Names say what things are; comments explain why
- [ ] No `any`, no unused code, no leftover `console.log`
- [ ] Tests cover the new rules and the bug being fixed

## 5. Performance
- [ ] No queries inside loops (N+1); use `include`, `in` or one SQL query
- [ ] Nothing slow (AI, PDF parsing, big queries) runs on a student page view
- [ ] Client bundles stay small: `"use client"` only where needed, heavy libraries loaded lazily
- [ ] Lists are paged; images sized; public pages cacheable

## 6. UX and accessibility
- [ ] Works at 360 px and on desktop; nothing hidden behind fixed bars
- [ ] Keyboard and screen reader friendly; focus visible; contrast AA; not colour alone; zoom works
- [ ] Loading, empty and error states exist and use plain English
- [ ] Wording follows the student's level (module/subject)

## 7. Release
- [ ] CI is green (lint, type check, tests, build)
- [ ] Preview deployment checked on a real phone
- [ ] Analytics event added if a funnel step changed
- [ ] Regression checklist run for the areas touched (`docs/qa/regression-checklist.md`)
