# Runbook: database migrations

## Rules

1. **Never run `prisma migrate dev` or `prisma db push` against Neon production.** `migrate dev` can reset the database. Locally only.
2. **Production is migrated only by the Release to production workflow** (`prisma migrate deploy`, after approval and a backup branch). Staging is migrated by its Vercel build. Nobody runs `migrate deploy` against production from a laptop; the only exceptions are `migrate status` and `migrate resolve` in the two cases at the end of this page.
3. **Never edit or delete a migration that's on `main`.** Add a new one. CI fails if you do.
4. **Expand, then contract.** The migration goes live a few minutes *before* the code, and a rollback puts old code on the new schema. So every migration must work with both the old and the new code.
5. **New columns** keep using raw SQL with `orFallback()` until the column is in `schema.prisma` and the client is regenerated (ADR 0004).

## Expand/contract by example

| Change | Release 1 (expand) | Release 2 (migrate data / switch) | Release 3 (contract) |
|---|---|---|---|
| Add a column | `ADD COLUMN x TEXT` (nullable) or `NOT NULL DEFAULT …` | Code writes and reads `x` | – |
| Make a column required | Code always writes it; backfill `UPDATE … WHERE x IS NULL` | `SET NOT NULL` (+ `-- tyro:allow-destructive`) | – |
| Rename a column | Add the new column; code writes both | Backfill; code reads the new one | Drop the old one (+ allow-destructive) |
| Remove a table or column | Code stops using it | Wait at least one release (rollback window) | `DROP` (+ allow-destructive, second review) |
| Index on a big table | Own migration file with `CREATE INDEX CONCURRENTLY` and nothing else | – | – |

Big tables today: `user_answers`, `analytics_events`, `messages`, `quiz_attempts`, `users`.

## Making a migration

```bash
npm run db:up                                    # local Docker Postgres
npx prisma migrate dev --create-only --name add_something   # LOCAL database only
# edit prisma/migrations/<timestamp>_add_something/migration.sql if needed
npx prisma migrate dev                           # applies it locally
npm run check:migrations                         # the same check CI runs
npm test
```

Then open the PR. CI applies all migrations to an empty Postgres, re-runs them, builds and runs the security tests. After merge, staging is migrated during its build: check `https://staging.tyrostudy.co.za/api/health` shows the new `migration`.

## A migration failed

**In CI or staging:** fix it with a *new* migration if it's on `main`; if the PR isn't merged yet, change the migration in the PR.

**In production (release workflow, migrate step):** nothing was deployed; the old code is still live.
1. Read the error in the job log. `npx prisma migrate status` (with the production direct URL in a secure shell, read-only) shows it as failed.
2. A migration file is sent to Postgres as one script, which normally runs as a single transaction, so a failed migration usually leaves nothing behind. If it partly applied (statements outside a transaction such as `CREATE INDEX CONCURRENTLY`), undo those statements by hand.
3. Mark it rolled back: `npx prisma migrate resolve --rolled-back <migration_name>`.
4. Fix it on `main` as a new migration (or edit the failed one only if it never succeeded anywhere but staging), release again.

## First release: baseline check (once)

Production was migrated by hand before this pipeline existed. Before the first release, check (read-only) that Prisma's history matches:

```bash
DATABASE_URL="<production direct URL>" npx prisma migrate status
```

- "Database schema is up to date" → nothing to do.
- Migrations listed as **not yet applied** that *are* already in the database (because they were applied by hand or with `db push`) → mark each one: `npx prisma migrate resolve --applied <name>`. Don't run `migrate deploy` until status is clean, or it will try to create tables that exist.
