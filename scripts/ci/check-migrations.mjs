#!/usr/bin/env node
/**
 * Safety checks for Prisma migrations, run in CI on every pull request.
 *
 *   node scripts/ci/check-migrations.mjs                 # compare with origin/main
 *   BASE_REF=origin/main node scripts/ci/check-migrations.mjs
 *   node scripts/ci/check-migrations.mjs --all           # lint every migration (report only)
 *
 * Fails when a change:
 *  1. edits or deletes a migration that already exists on the base branch
 *     (production has applied it; editing it causes drift or a failed deploy);
 *  2. adds a migration whose timestamp is older than the newest one on the base
 *     branch (it would run out of order on a fresh database);
 *  3. adds a migration folder without a migration.sql;
 *  4. contains a destructive or locking statement (DROP TABLE/COLUMN, RENAME,
 *     ALTER COLUMN TYPE, SET NOT NULL, TRUNCATE, DELETE without WHERE, ADD
 *     NOT NULL column without DEFAULT, CREATE INDEX without CONCURRENTLY on a
 *     big table) without an explicit opt-in comment in the file:
 *
 *        -- tyro:allow-destructive <reason, and the expand/contract step it completes>
 *
 * Why: the release workflow migrates the production database a few minutes
 * BEFORE the new code goes live, so every migration must work with the code
 * that is still running (expand first, contract in a later release).
 */
import { execSync } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const DIR = "prisma/migrations"
const ALL = process.argv.includes("--all")
const BASE = process.env.BASE_REF || "origin/main"
const BIG_TABLES = ["user_answers", "analytics_events", "messages", "quiz_attempts", "users"]

const RULES = [
  { re: /\bDROP\s+TABLE\b/i, why: "drops a table" },
  { re: /\bDROP\s+COLUMN\b/i, why: "drops a column (running code may still read it)" },
  { re: /\bRENAME\s+(COLUMN|TO)\b/i, why: "renames a column or table (running code uses the old name)" },
  { re: /\bALTER\s+COLUMN\s+"?\w+"?\s+(SET\s+DATA\s+)?TYPE\b/i, why: "changes a column type (rewrites and locks the table)" },
  { re: /\bSET\s+NOT\s+NULL\b/i, why: "adds NOT NULL to an existing column (fails if old code writes NULLs)" },
  { re: /\bTRUNCATE\b/i, why: "truncates a table" },
  { re: /\bDELETE\s+FROM\s+"?\w+"?\s*;/i, why: "deletes every row" },
  { re: /\bADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?"?\w+"?\s+[^,;]*\bNOT\s+NULL\b(?![^,;]*\bDEFAULT\b)/i, why: "adds a NOT NULL column without a DEFAULT (old code can't insert rows)" },
]

function sh(cmd) { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() }
function stripComments(sql) { return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "") }

function lint(name) {
  const file = join(DIR, name, "migration.sql")
  if (!existsSync(file)) return [`${name}: no migration.sql in the folder`]
  const raw = readFileSync(file, "utf8")
  if (/--\s*tyro:allow-destructive\s+\S/.test(raw)) return []
  const sql = stripComments(raw)
  const problems = RULES.filter(r => r.re.test(sql)).map(r => `${name}: ${r.why}`)
  const createdHere = new Set([...sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi)].map(m => m[1]))
  for (const m of sql.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?!CONCURRENTLY)[^;]*\bON\s+"?(\w+)"?/gi)) {
    if (BIG_TABLES.includes(m[2]) && !createdHere.has(m[2])) problems.push(`${name}: CREATE INDEX on ${m[2]} without CONCURRENTLY locks writes (Prisma: put it in its own migration with CONCURRENTLY)`)
  }
  return problems
}

const local = readdirSync(DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort()

if (ALL) {
  const all = local.flatMap(lint)
  console.log(all.length ? all.map(p => `  - ${p}`).join("\n") : "No risky statements found.")
  console.log(`\n${local.length} migrations checked (report only).`)
  process.exit(0)
}

let changes
try {
  sh(`git rev-parse --verify ${BASE}`)
  changes = sh(`git diff --name-status ${BASE}...HEAD -- ${DIR}`)
} catch {
  console.error(`Can't compare with ${BASE}. In CI, check out with fetch-depth: 0.`)
  process.exit(2)
}

const baseNames = sh(`git ls-tree -d --name-only ${BASE}:${DIR}`).split("\n").filter(Boolean).sort()
const newestBase = baseNames.at(-1) ?? ""
const errors = []
const added = new Set()

for (const line of changes.split("\n").filter(Boolean)) {
  const [status, ...paths] = line.split("\t")
  for (const p of paths) {
    const name = p.split("/")[2]
    if (!name || name === "migration_lock.toml") continue
    if (baseNames.includes(name)) {
      if (status !== "A") errors.push(`${name}: already applied in production; don't ${status.startsWith("D") ? "delete" : "edit"} it. Add a new migration instead.`)
    } else added.add(name)
  }
}

for (const name of [...added].sort()) {
  if (name < newestBase) errors.push(`${name}: older than ${newestBase} on ${BASE}. Rename the folder with a current timestamp.`)
  errors.push(...lint(name))
}

if (errors.length) {
  console.error("Migration check failed:\n" + errors.map(e => `  - ${e}`).join("\n"))
  console.error("\nSee docs/runbooks/migrations.md (expand/contract). If a destructive step is intended, add\n  -- tyro:allow-destructive <reason>\nto the migration and get a second review.")
  process.exit(1)
}
console.log(added.size ? `Migration check passed for: ${[...added].join(", ")}` : "No new migrations.")
