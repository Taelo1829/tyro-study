#!/usr/bin/env node
/**
 * Post-deploy smoke test. Read-only: safe to run against production.
 *
 *   BASE_URL=https://www.tyrostudy.co.za EXPECT_COMMIT=<sha> EXPECT_MIGRATION=<name> node scripts/ci/smoke.mjs
 *
 * Waits (up to WAIT_SECONDS, default 600) until /api/health reports the
 * expected commit, then checks that key public pages and APIs answer as
 * expected. Exits 1 on failure so the release workflow stops and says so.
 * SMOKE_ALLOW_MISSING_SERVICES=1 (CI only) accepts 503 from checks that need
 * an external service key.
 */
const BASE = (process.env.BASE_URL || "http://localhost:4000").replace(/\/$/, "")
const EXPECT = process.env.EXPECT_COMMIT || ""
const EXPECT_MIGRATION = process.env.EXPECT_MIGRATION || ""
const WAIT = Number(process.env.WAIT_SECONDS || 600)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function get(path) {
  const started = Date.now()
  try {
    const res = await fetch(BASE + path, { redirect: "manual", headers: { "user-agent": "tyro-smoke-test" } })
    const text = await res.text()
    return { status: res.status, text, headers: res.headers, ms: Date.now() - started }
  } catch (e) {
    return { status: 0, text: String(e), headers: new Headers(), ms: Date.now() - started }
  }
}

// 1. Wait for the new deployment to be live.
let health
const deadline = Date.now() + WAIT * 1000
for (;;) {
  const r = await get("/api/health")
  try { health = JSON.parse(r.text) } catch { health = null }
  const live = r.status === 200 && health?.ok && (!EXPECT || health.commit === EXPECT)
  if (live) break
  if (Date.now() > deadline) {
    console.error(`Health check never reported ${EXPECT || "ok"} (last: ${r.status} ${r.text.slice(0, 200)})`)
    process.exit(1)
  }
  await sleep(10000)
}
console.log(`Live: commit ${health.commit.slice(0, 7)}, env ${health.env}, migration ${health.migration}`)
if (health.flags) console.log(`Flags: ${Object.entries(health.flags).map(([k, v]) => `${k}=${v}`).join(", ")}`)
let failed = 0
if (EXPECT_MIGRATION) {
  const ok = health.migration === EXPECT_MIGRATION
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  database has migration ${EXPECT_MIGRATION}${ok ? "" : ` (latest applied: ${health.migration})`}`)
}

// 2. Key pages and APIs.
const checks = [
  ["/", 200, /Tyro/i],
  ["/notes", 200, null],
  ["/login", 200, null],
  ["/register", 200, null],
  ["/privacy", 200, null],
  ["/api/modules", 200, null],
  ["/api/push/public-key", 200, null, "service"], // 503 where VAPID keys aren't configured
  ["/dashboard", [302, 303, 307, 308], null], // signed out → sign-in page
  ["/api/progress/modules", 401, null],       // protected API still protected
  ["/api/topics?chapterId=smoke", 401, null],  // lesson text not public (business/08 §3.2)
]
const allowMissing = process.env.SMOKE_ALLOW_MISSING_SERVICES === "1" // CI: no VAPID, Resend, etc.
for (const [path, want, body, kind] of checks) {
  const r = await get(path)
  const statusOk = (Array.isArray(want) ? want.includes(r.status) : r.status === want) || (kind === "service" && allowMissing && r.status === 503)
  const ok = statusOk && (!body || body.test(r.text))
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${path.padEnd(24)} ${r.status}  ${r.ms} ms`)
}
// Security headers present on a normal page (HTTPS deployments only)
if (BASE.startsWith("https://")) {
  const home = await get("/")
  for (const h of ["strict-transport-security", "x-content-type-options", "content-security-policy"]) {
    const ok = !!home.headers.get(h)
    if (!ok) failed++
    console.log(`${ok ? "PASS" : "FAIL"}  header ${h}${ok ? `: ${home.headers.get(h)}` : " missing"}`)
  }
}
console.log(failed ? `\n${failed} smoke check(s) failed` : "\nSmoke test passed")
process.exit(failed ? 1 : 0)
