# Contributing to Tyro Study

How code gets from an idea to production. The full reasoning is in `business/06-development-and-version-control.md`; decisions are in `docs/adr/`.

## 1. Workflow (GitHub Flow)

1. Pick a backlog item (TS-xxx) that meets the Definition of Ready (`business/05-project-plan.md` §6.2).
2. Branch from an up-to-date `main`:
   ```bash
   git switch main && git pull
   git switch -c feat/ts-012-quiz-focus-mode
   ```
   Prefixes: `feat/`, `fix/`, `chore/`, `refactor/`, `docs/`, `test/`. Always include the item id.
3. Commit small, working steps (section 3). Push early: Vercel builds a preview for every branch.
4. Open a pull request into `main` using the template. CI must be green.
5. Check the preview on a phone. Tick the Definition of Done.
6. **Squash and merge**, delete the branch. `main` deploys to **staging** (`staging.tyrostudy.co.za`) and migrates the staging database.
7. Production is released with the **Release to production** workflow (`docs/runbooks/release.md`), which migrates production after approval and a Neon backup. Never run migrations against production by hand (`docs/runbooks/migrations.md`).

`main` is always deployable. Never commit straight to `main`; protect it in GitHub (Settings → Branches: require a pull request and the CI check).

## 2. Coding standards

**TypeScript**
- Strict mode; no `any` (use `unknown` and narrow). No `@ts-ignore` without a comment saying why.
- Import with the `@/` alias (`@/lib/prisma`), not long relative paths.
- Validate every request body before use; return errors as `{ error: "Message for the student" }` with the right status (400, 401, 403, 404, 409, 429, 500).

**Structure**
- Pages and route handlers in `src/app`; domain logic in `src/lib/<area>.ts`; UI in `src/components/<area>`; shared UI in `src/components/ui`.
- Route handlers stay thin: parse → check session and role → call `lib` → respond. `lib` never imports from `app`.
- Server Components by default; add `"use client"` only when a component needs state, effects or browser APIs.
- Files are `kebab-case.ts(x)`; components are `PascalCase`; hooks are `use-something.ts`.

**Database**
- Change the schema only through a migration: `prisma/migrations/YYYYMMDDHHMMSS_short_name/migration.sql`, additive where possible.
- New columns read before the client is regenerated use tagged-template raw SQL inside `orFallback()` (ADR 0004). Never concatenate SQL strings.
- Scope every query to the signed-in user unless the route is admin-only.
- Store times in UTC; do day maths in Africa/Johannesburg.

**Security**
- Check authorisation on the server in every route: `requireAuth()`, `requireAdmin()`, `canManageAdmins()`.
- No secrets in code. No personal data (names, emails, message text, tokens) in logs or analytics.
- Side effects (Pusher, push, email, analytics) must never undo or fail the main action.

**UI and copy**
- Use the design tokens (`--neo-*`, Tailwind) and components from `03-ux-ui-design.pdf`. One main action per screen.
- Accessible: real buttons and labels, visible focus, contrast AA, never colour alone, works at 360 px and with zoom.
- Plain English, short sentences, South African spelling. Say "module"/"subject" according to the student's level (`useTerms()`).
- No `alert()` / `confirm()`: use toasts and sheets.

**Style**
- 2 spaces, double quotes, no semicolons in new files (the style most of the code uses). Don't reformat code you aren't changing, so diffs stay readable.
- Comments explain *why*, not what. Keep the existing habit of a short doc comment on exported functions.

## 3. Commit messages (Conventional Commits)

```
<type>(<scope>): <what changed, imperative, ≤ 72 chars>

<why, and anything a reviewer must know>

Refs: TS-012
```

Types: `feat` (user-visible feature), `fix` (bug), `refactor`, `perf`, `test`, `docs`, `chore` (tooling, deps), `ci`, `build`, `revert`. Scope is the area: `quiz`, `auth`, `analytics`, `chat`, `admin`, `db`, `ui`…

Good: `fix(quiz): keep Check answer above the bottom nav on phones`
Not: `worked on content creation`, `fixes`, `update`

## 4. Environment variables and secrets

- Copy `.env.example` to `.env.local` and fill it in. `.env*` files are git-ignored (except the example).
- Local development uses the Docker database (`npm run db:up`), never production.
- Real values live in Vercel → Settings → Environment Variables, separately for Development, Preview and Production. Use different keys for Preview and Production where the service allows.
- Seeding an admin: set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env.local`, then `npm run db:seed` (refuses remote databases unless `SEED_ALLOW_REMOTE=1`).
- If a secret is ever committed or shared: rotate it at the provider first, update Vercel, redeploy. Removing it from Git history doesn't un-leak it.
- Turn on GitHub secret scanning and push protection for the repository.

## 5. Tests

```bash
npm test            # all unit and integration tests (seconds)
npm run test:watch  # while working
npm run typecheck
npm run lint
```

- Unit tests sit next to the code: `src/lib/topic-locks.test.ts`.
- Integration tests in `test/integration/` run real SQL against an in-memory PostgreSQL (PGlite), with the real migrations (ADR 0009). They never connect to Neon.
- Every bug fix gets a test that would have caught it. Every new rule in `lib` gets unit tests. Every new route gets a permission check test when route tests exist.

## 6. Documenting decisions

Add an ADR in `docs/adr/` (copy 0001) when you choose a technology, change the data model shape, change the security model or set a convention. Link it from the PR.
