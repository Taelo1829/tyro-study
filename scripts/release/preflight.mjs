#!/usr/bin/env node
/**
 * Release preflight: run on your PC right before starting the Release to
 * production workflow. Read-only (git fetch and HTTP GETs).
 *
 *   node scripts/release/preflight.mjs 1.0.0
 *   STAGING_URL=https://staging.tyrostudy.co.za PRODUCTION_URL=https://www.tyrostudy.co.za node scripts/release/preflight.mjs 1.0.0
 *
 * Checks: local main matches origin/main; CHANGELOG has the version; staging
 * runs origin/main on the newest migration and passes the smoke test; what
 * production runs now (your rollback target). Prints a go/no-go summary.
 */
import { execSync, spawnSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"

const version = (process.argv[2] || "").replace(/^v/, "")
const STAGING = (process.env.STAGING_URL || "https://staging.tyrostudy.co.za").replace(/\/$/, "")
const PRODUCTION = (process.env.PRODUCTION_URL || "https://www.tyrostudy.co.za").replace(/\/$/, "")
const sh = cmd => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()

const rows = []
const check = (ok, label, detail = "", warnOnly = false) => rows.push({ status: ok ? "PASS" : warnOnly ? "WARN" : "FAIL", label, detail })

async function health(base) {
  try {
    const res = await fetch(`${base}/api/health`, { headers: { "user-agent": "tyro-preflight" } })
    const body = await res.json().catch(() => null)
    return { status: res.status, body }
  } catch (e) {
    return { status: 0, body: null, error: String(e.message || e) }
  }
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/release/preflight.mjs <version>, e.g. 1.0.0")
  process.exit(2)
}

// 1. Git
let mainSha
try {
  sh("git fetch origin --quiet --tags")
  const branch = sh("git rev-parse --abbrev-ref HEAD")
  const head = sh("git rev-parse HEAD")
  const main = sh("git rev-parse origin/main")
  const dirty = sh("git status --porcelain")
  check(branch === "main", "On branch main", branch)
  check(head === main, "Local main matches origin/main", `${head.slice(0, 7)} vs ${main.slice(0, 7)}`)
  check(!dirty, "No uncommitted changes", dirty ? dirty.split("\n").length + " file(s)" : "")
  const tagExists = sh(`git tag -l v${version}`) !== ""
  check(!tagExists, `Tag v${version} is new`)
  mainSha = main
} catch (e) {
  check(false, "Git", String(e.message).split("\n")[0])
}

// 2. Changelog
const changelog = readFileSync("CHANGELOG.md", "utf8")
check(changelog.includes(`## [${version}]`), `CHANGELOG.md has a ## [${version}] section`)

// 3. Staging
const latestMigration = readdirSync("prisma/migrations", { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort().at(-1)
const stg = await health(STAGING)
check(stg.status === 200 && stg.body?.ok, "Staging is healthy", stg.status ? `HTTP ${stg.status}` : stg.error)
if (stg.body) {
  check(stg.body.commit === mainSha, "Staging runs origin/main", `${String(stg.body.commit).slice(0, 7)}`)
  check(stg.body.migration === latestMigration, "Staging database has the newest migration", `${stg.body.migration} (repo: ${latestMigration})`)
  if (stg.body.flags) rows.push({ status: "INFO", label: "Staging flags", detail: JSON.stringify(stg.body.flags) })
}
const smoke = spawnSync(process.execPath, ["scripts/ci/smoke.mjs"], {
  env: { ...process.env, BASE_URL: STAGING, EXPECT_COMMIT: mainSha ?? "", WAIT_SECONDS: "20" },
  encoding: "utf8",
})
check(smoke.status === 0, "Staging smoke test", smoke.status === 0 ? "" : (smoke.stdout + smoke.stderr).split("\n").filter(l => l.startsWith("FAIL")).join("; "))

// 4. Production now (rollback target)
const prod = await health(PRODUCTION)
if (prod.status === 200 && prod.body) {
  rows.push({ status: "INFO", label: "Production now (Instant Rollback target)", detail: `commit ${String(prod.body.commit).slice(0, 7)}, migration ${prod.body.migration}` })
} else if (prod.status === 404) {
  check(false, "Production health endpoint", "404: arrives with this release (first release only)", true)
} else {
  check(false, "Production reachable", prod.status ? `HTTP ${prod.status}` : prod.error)
}

// Report
for (const r of rows) console.log(`${r.status.padEnd(5)} ${r.label}${r.detail ? `  (${r.detail})` : ""}`)
const fails = rows.filter(r => r.status === "FAIL").length
console.log(fails ? `\nNO-GO: ${fails} check(s) failed` : `\nGO: preflight passed for v${version}. Next: GitHub → Actions → Release to production.`)
process.exit(fails ? 1 : 0)
