# 0010 Release pipeline: main is staging, a workflow promotes to production

- **Status:** Accepted
- **Date:** 2026-10-29

## Context
Every push to `main` went straight to production on Vercel, and database migrations were run by hand. Code could go live before its migration (or the other way round), there was no staging environment, no restore point before a migration and no record of what was released when.

## Decision
- **Four environments:** development (local Docker Postgres), test (CI with a throwaway Postgres; Vercel preview per pull request), staging (`main` branch → `staging.tyrostudy.co.za`, Neon `staging` branch with test data only), production (`production` branch → `www.tyrostudy.co.za`, Neon production branch).
- **Vercel production branch is `production`.** Nobody pushes to it by hand; the **Release to production** workflow fast-forwards it to a commit that passed CI on `main`.
- **Migrations:** staging is migrated during its Vercel build (`MIGRATE_ON_BUILD=1`, scoped to `main`). Production is migrated by the release workflow, after a reviewer approves and after a Neon backup branch is created, **before** the new code goes live.
- **Expand/contract only.** Every migration must work with the code already running. Destructive steps go in a later release and need `-- tyro:allow-destructive` plus a second review; `scripts/ci/check-migrations.mjs` enforces this in CI.
- **Rollback:** Vercel Instant Rollback for code; Neon restore (backup branch or history window) for data, only when data is damaged.
- **Versions:** semantic versions, `CHANGELOG.md`, a git tag and GitHub release per production release.

## Consequences
One extra step to release (run a workflow, approve), in exchange for a staging check, a restore point and a clean audit trail. Because the migration runs a few minutes before the code switches, a non-additive migration would break the live site; the CI check and the PR checklist guard against that. Vercel Hobby can roll back only to the previous deployment, so releases should stay small.
