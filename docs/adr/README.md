# Architecture decision records

Short notes on decisions that shape the code, so the reasons survive after the conversation is forgotten. One file per decision, numbered, never rewritten: if a decision changes, add a new record that **supersedes** the old one and update the old one's status.

| # | Decision | Status |
|---|---|---|
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-nextjs-modular-monolith.md) | One Next.js app (modular monolith) on Vercel | Accepted |
| [0003](0003-postgres-neon-prisma.md) | PostgreSQL on Neon through Prisma | Accepted |
| [0004](0004-raw-sql-for-new-columns.md) | Raw SQL with fallbacks for newly added columns | Accepted |
| [0005](0005-jwt-sessions-and-email-otp.md) | JWT sessions with email-verified sign-up | Accepted |
| [0006](0006-first-party-analytics.md) | First-party product analytics in Postgres | Accepted |
| [0007](0007-module-group-chats.md) | Module group chats replace one-to-one chat | Accepted (later stage) |
| [0008](0008-ai-behind-lib-ai.md) | AI providers only behind `src/lib/ai` | Accepted |
| [0009](0009-testing-with-vitest-and-pglite.md) | Vitest for tests, PGlite for database tests | Accepted |
| [0010](0010-release-pipeline.md) | Release pipeline: main is staging, a workflow promotes to production | Accepted |

Template: copy `0001`, change the number and title, fill in Context, Decision, Consequences.
