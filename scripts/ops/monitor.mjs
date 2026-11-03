#!/usr/bin/env node
/**
 * Synthetic production check (read-only). Run by .github/workflows/monitor.yml
 * every hour, or by hand:
 *
 *   BASE_URL=https://www.tyrostudy.co.za MONITOR_TOKEN=... node scripts/ops/monitor.mjs
 *
 * Status:
 *   down      the site or database is unreachable, or a key page fails  → exit 1
 *   degraded  slow pages, a scheduled job that stopped, an error spike   → exit 0, reported
 *   ok
 * Writes monitor-result.json ({ status, problems[], checks[] }) for the alert step.
 */
import { writeFileSync } from "node:fs"

const BASE = (process.env.BASE_URL || "https://www.tyrostudy.co.za").replace(/\/$/, "")
const TOKEN = process.env.MONITOR_TOKEN || ""
const SLOW_MS = Number(process.env.SLOW_MS || 3000) // a page slower than this (twice) is "degraded"
const DOWN_MS = Number(process.env.DOWN_MS || 15000) // no answer in this time counts as a failure
const ERROR_SPIKE = Number(process.env.ERROR_SPIKE || 5) // new error groups in the last hour
const OUT = process.env.OUT || "monitor-result.json"
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function get(path, headers = {}) {
  const started = Date.now()
  try {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "tyro-monitor", ...headers }, signal: AbortSignal.timeout(DOWN_MS) })
    const text = await res.text()
    return { status: res.status, ms: Date.now() - started, text }
  } catch (e) {
    return { status: 0, ms: Date.now() - started, text: String(e?.message || e) }
  }
}

const checks = []
const problems = []
let status = "ok"
const worsen = s => { if (s === "down" || (s === "degraded" && status === "ok")) status = s }

// 1. Health: retry twice before calling it down (avoids alerting on one blip / a cold start).
let health = null
for (let attempt = 1; attempt <= 3; attempt++) {
  const r = await get("/api/health", TOKEN ? { authorization: `Bearer ${TOKEN}` } : {})
  try { health = JSON.parse(r.text) } catch { health = null }
  checks.push({ name: `health (attempt ${attempt})`, status: r.status, ms: r.ms })
  if (r.status === 200 && health?.ok) break
  if (attempt === 3) {
    worsen("down")
    problems.push(`Health check failed 3 times: HTTP ${r.status || "no answer"}${health?.error ? ` (${health.error})` : ""}`)
  } else await sleep(20000)
}

// 2. Key pages: availability and latency (measured twice; slow only if both are slow).
const PAGES = [
  ["/", 200],
  ["/notes", 200],
  ["/login", 200],
  ["/api/modules", 200],
  ["/dashboard", [302, 303, 307, 308]],
]
for (const [path, want] of PAGES) {
  const a = await get(path)
  const b = await get(path)
  const ok = r => (Array.isArray(want) ? want.includes(r.status) : r.status === want)
  const best = a.ms <= b.ms ? a : b
  checks.push({ name: path, status: b.status, ms: best.ms })
  if (!ok(a) && !ok(b)) {
    worsen("down")
    problems.push(`${path} answered ${b.status || "nothing"} (expected ${want})`)
  } else if (best.ms > SLOW_MS) {
    worsen("degraded")
    problems.push(`${path} is slow: ${best.ms} ms (limit ${SLOW_MS} ms)`)
  }
}

// 3. Details (needs MONITOR_TOKEN): scheduled jobs, error spike, database latency.
const d = health?.details
if (TOKEN && health?.ok && !d) {
  worsen("degraded")
  problems.push("MONITOR_TOKEN was not accepted by /api/health (check it matches in Vercel and GitHub)")
}
if (d) {
  for (const h of d.heartbeats ?? []) {
    checks.push({ name: `job ${h.name}`, stale: h.stale, minutesSinceOk: h.minutesSinceOk })
    if (h.stale) {
      worsen("degraded")
      problems.push(`Scheduled job ${h.name} hasn't succeeded ${h.minutesSinceOk === null ? "yet (never ran)" : `for ${h.minutesSinceOk} min`} (limit ${h.limitMinutes} min)${h.lastError ? `: ${h.lastError}` : ""}`)
    }
  }
  checks.push({ name: "errors", ...d.errors })
  if ((d.errors?.newLastHour ?? 0) >= ERROR_SPIKE) {
    worsen("degraded")
    problems.push(`${d.errors.newLastHour} new error types in the last hour (Admin → Monitoring)`)
  }
  checks.push({ name: "database", ms: d.dbMs })
  if (d.dbMs > 1000) {
    worsen("degraded")
    problems.push(`Database is slow: SELECT 1 took ${d.dbMs} ms`)
  }
}

const result = { status, base: BASE, checkedAt: new Date().toISOString(), commit: health?.commit ?? null, problems, checks }
writeFileSync(OUT, JSON.stringify(result, null, 2))
for (const c of checks) console.log(JSON.stringify(c))
console.log(`\n${status.toUpperCase()}${problems.length ? ":\n- " + problems.join("\n- ") : ""}`)
process.exit(status === "down" ? 1 : 0)
