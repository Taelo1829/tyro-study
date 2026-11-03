#!/usr/bin/env node
/**
 * Vercel build command (vercel.json → buildCommand).
 *
 *  1. Checks the environment variables for this environment (check-env.mjs).
 *  2. Preview and staging only: applies pending migrations to THAT environment's
 *     own database, when MIGRATE_ON_BUILD=1 is set for it in Vercel. Production
 *     is never migrated here: the release workflow migrates it, with approval
 *     and a backup branch, before promoting the code.
 *  3. Runs the normal build.
 *
 * Set MIGRATE_ON_BUILD=1 only on Preview environment variables whose
 * DATABASE_URL is a Neon branch (per-PR branches from the Neon integration, or
 * the long-lived "staging" branch). Never on a Preview that shares the
 * production database.
 */
import { execSync } from "node:child_process"

const env = process.env.VERCEL_ENV || "development"
const run = cmd => { console.log(`\n$ ${cmd}`); execSync(cmd, { stdio: "inherit" }) }

run("node scripts/ci/check-env.mjs")

if (env === "production") {
  console.log("[vercel-build] production: skipping migrations (the release workflow applies them)")
} else if (process.env.MIGRATE_ON_BUILD === "1") {
  run("npx prisma migrate deploy")
} else {
  console.log(`[vercel-build] ${env}: MIGRATE_ON_BUILD is not 1, skipping migrations`)
}

run("npm run build")
