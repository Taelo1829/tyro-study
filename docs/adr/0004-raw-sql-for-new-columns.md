# 0004 Raw SQL with fallbacks for newly added columns

- **Status:** Accepted
- **Date:** 2026-10-29 (records the existing pattern)

## Context
The generated Prisma client is committed (`src/prisma`), and deploys can run before a migration has been applied. Reading a new column through the typed client fails if the client or the database is behind, which would take pages down.

## Decision
For columns and tables added after the client (for example `topics.locked`, `topics.published`, `users.isSuperuser`, `analytics_events`), read and write them with `prisma.$queryRaw` / `$executeRaw`, wrapped in `orFallback()` (`src/lib/db-safe.ts`) so a missing migration loses a small feature, not the page. Always use tagged templates (parameters are escaped); never build SQL strings by hand.

## Consequences
Deploy order matters less and nothing breaks between deploy and migrate. The cost is less type safety in those queries, so they need tests (see 0009). Once a column is old and the client regenerated, prefer the typed client again.
