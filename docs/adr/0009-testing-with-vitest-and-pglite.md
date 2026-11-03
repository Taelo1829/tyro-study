# 0009 Vitest for tests, PGlite for database tests

- **Status:** Accepted
- **Date:** 2026-10-29

## Context
The project had no automated tests. Much of the important logic is pure TypeScript (locks, scoring, mock exam plan, answer matching) or raw SQL (analytics, locks, streaks) that the type checker can't verify.

## Decision
- **Vitest** for unit tests, next to the code: `src/lib/<name>.test.ts`.
- **Integration tests** in `test/integration/`, running real SQL and real migrations against **PGlite** (PostgreSQL compiled to WebAssembly, in memory). No network, no shared test database, nothing to clean up.
- Tests never touch Neon; `vitest.config.ts` sets a placeholder `DATABASE_URL`.
- CI (`.github/workflows/ci.yml`) runs `prisma validate`, type check, tests and build on every pull request.
- End-to-end tests (Playwright) come later for the core flow: sign up → join module → pass a quiz.

## Consequences
Fast tests (seconds) that can run on any machine and in CI. PGlite is close to PostgreSQL but not identical (extensions, some settings), so anything provider-specific still gets checked on a Neon branch.
