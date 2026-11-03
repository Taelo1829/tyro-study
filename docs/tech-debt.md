# Technical debt register

Debt we know about, why it matters, and when we'll pay it. Reviewed in the monthly maintenance review (business/12 §5). Add an item whenever a shortcut is taken on purpose or found; close it with the release that fixes it.

**Priority:** P1 = risk to students or data, fix in the next 1–2 releases. P2 = slows us down or degrades experience, schedule this quarter. P3 = tidy-up.

| Id | Debt | Impact | Priority | Plan / release | Status |
|---|---|---|---|---|---|
| TD-01 | Next.js 16.2.6 with a critical advisory (proxy bypass, DoS) | Security | P1 | Upgraded to 16.4.3 | **Fixed in v1.0.0** |
| TD-02 | SheetJS `xlsx` 0.18.5: abandoned on npm, prototype pollution and ReDoS | Security (admin uploads) | P1 | Replaced with `exceljs`; `.xls` no longer accepted | **Fixed in v1.0.0** |
| TD-03 | `next-pwa` 5 unmaintained; pulls old Workbox/Rollup (low advisories, build-time) | Build tooling ages; blocks Workbox updates | P2 | Move to Serwist (`@serwist/next`); retest PWA install and push on iOS/Android | v1.2.0 (Jan 2027) |
| TD-04 | Admin pages relied on the layout's redirect; pages rendered data for students | Security | P1 | Proxy role check + `requireAdminPage()` in every data-loading admin page + tests | **Fixed in v1.0.0** |
| TD-05 | Quiz finish wrote answer history one question at a time (2 statements per question) | Exam-time latency on Neon | P1 | `saveFinalAnswers()` batch: constant 16 statements | **Fixed in v1.0.0** |
| TD-06 | No sign-in rate limit; sign-up revealed registered emails | Security / privacy | P1 | Postgres rate limits; generic sign-up response with owner notice email | **Fixed in v1.0.0** |
| TD-07 | Raw SQL + `orFallback` for newer columns and tables (ADR 0004); some tables only recently added to `schema.prisma` | Two ways of querying; type safety gaps | P2 | Regenerate the client with all models; move hot paths (feedback, monitoring) to typed Prisma calls; retire fallbacks for columns older than 3 months | v1.1.0 onwards |
| TD-08 | Generated Prisma client committed in `src/prisma` (still 7.8.0 while the package is 7.10.1) | Version drift risk | P2 | `npx prisma generate` and commit (CI now checks) | Before v1.0.0 |
| TD-09 | High school learners can open university topics by id (E-11) | Product rule not enforced on the server | P2 | Decide the rule; enforce in topic/quiz routes; remove from `known-issues.json` | v1.1.0 |
| TD-10 | Forgot-password differs only when email isn't configured | Test noise | P3 | Configure Resend on previews; make the route ignore send failures in its response | v1.1.0 |
| TD-11 | Large route files (quiz attempt route ~800 lines) mixing HTTP, rules and SQL | Hard to change safely | P2 | Extract quiz logic into `src/lib/quiz/*` with tests, one route at a time | v1.2.0 |
| TD-12 | Full script/style CSP not enforced (only frame-ancestors etc.) | Defence in depth against XSS | P2 | Report-only CSP for 2 weeks, then enforce | v1.1.0 |
| TD-13 | Major upgrades pending: TypeScript 7, Vitest 5, ESLint 10, Prisma 8, React 19.3 | Falling behind; harder later | P3 | One per month on a spike branch (calendar, business/12 §4) | Dec 2026 – Mar 2027 |
| TD-14 | `uuid` and `serialize-javascript` forced with npm `overrides` | Overrides can hide breaking changes | P3 | Remove when `exceljs`/`next-pwa` replacements land | With TD-03 |
| TD-15 | Some admin tables only scroll horizontally on phones | Admin usability | P3 | Card layout on small screens | When touched |
