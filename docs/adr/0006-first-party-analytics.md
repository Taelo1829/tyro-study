# 0006 First-party product analytics in Postgres

- **Status:** Accepted
- **Date:** 2026-10-29

## Context
The business goals need activation, Day-1 and Day-7 return and a funnel. Third-party tools add cost, cookies and another POPIA subprocessor; Vercel Analytics custom events need a paid plan.

## Decision
Record events in our own `analytics_events` table. Server events via `track()` (`src/lib/analytics.ts`, written after the response with `after()`); browser events via `trackEvent()` → `POST /api/events` with an allowlist. Props hold ids and numbers only; paths lose query strings; rows are deleted with the user. Reports are SQL in `src/lib/analytics-report.ts`, shown at `/admin/analytics`, excluding admins and counting days in South African time.

## Consequences
No new vendor, data stays in our database, metrics match our definitions exactly. We maintain the queries ourselves and must add a rollup table when events grow past about a million rows. Event names are a contract: add them to `analytics-shared.ts`, never rename silently.
