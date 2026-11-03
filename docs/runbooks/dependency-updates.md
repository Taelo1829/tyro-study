# Runbook: dependency updates and vulnerability patches

## Cadence

| What | When | Who decides |
|---|---|---|
| **Security advisories** (Dependabot security alerts, `npm audit`) | Critical/high in production dependencies: patch within **7 days** (critical: 48 hours, as a hotfix if needed). Moderate: next release. Low or dev-only: monthly batch | You |
| **Patch and minor updates** | Weekly Dependabot PRs (Monday 06:00), grouped: `next`, `prisma`, `runtime`, `dev-tools`. Merge when CI is green | You |
| **Major versions** | Planned in the maintenance calendar (business/12 §4); never merged ad hoc. Dependabot ignores majors | You, after a spike branch |
| **Full audit** | First Monday of the month: `npm audit --omit=dev`, `npm outdated`, review `docs/tech-debt.md` | You |

## Applying an update

1. Let Dependabot open the PR (or `git switch -c chore/deps-<name>` and `npm install <pkg>@<version>`; use npm 11: `npx npm@11 install …`, because npm 10 has a lockfile bug with Vitest 4).
2. **Prisma updates:** run `npx prisma generate` and commit `src/prisma/` in the same PR. CI fails if the committed client doesn't match the installed Prisma version or the schema.
3. **Next.js updates:** read the release notes for App Router, Turbopack and `next-auth` compatibility; keep `next` and `eslint-config-next` on the same exact version.
4. CI must be green: lint, types, tests, migrations from scratch, build, smoke, **security tests**.
5. On staging after merge: sign in, open a lesson, finish a quiz, admin pages.
6. Release as a **patch** version; add a line to CHANGELOG under *Security* or *Changed*.

## When there's no fix

| Situation | Options, in order |
|---|---|
| Fixed version exists only for a transitive dependency | `overrides` in package.json (as done for `uuid` and `serialize-javascript`), test, note it in `docs/tech-debt.md` so it's removed when the parent updates |
| Package abandoned | Replace it (as done for SheetJS `xlsx` → `exceljs`) |
| Vulnerable code isn't reachable (e.g. build-time only) | Record the reasoning in `docs/tech-debt.md` with a review date; keep `npm audit` output in the monthly review |

## Current exceptions (October 2026)

| Advisory | Where | Why accepted | Plan |
|---|---|---|---|
| `deepmerge`, `workbox-*`, `@rollup/plugin-node-resolve` (low) | `next-pwa` 5 (unmaintained), **build time only**: generates the service worker | Not in the running app | Replace `next-pwa` with Serwist (TD-03) in v1.2.0 |
