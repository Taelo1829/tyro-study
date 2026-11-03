#!/usr/bin/env node
/**
 * Tyro Study security and permission tests (black-box, over HTTP).
 *
 * Run against a LOCAL server or a Vercel PREVIEW with a seeded test database,
 * never against production with real students:
 *
 *   BASE_URL=http://localhost:4000 \
 *   STUDENT_A=a@test.local STUDENT_B=b@test.local LEARNER_H=h@test.local \
 *   ADMIN=admin@test.local SUPERUSER=super@test.local TEST_PASSWORD='...' \
 *   CRON_SECRET='...' node scripts/qa/security-tests.mjs
 *
 * Expects the fixtures from scripts/qa/seed-test-data.mjs (ids like u_b, ev_b,
 * qa_b, conv_bh, t1, t2). Prints a pass/fail table and exits 1 on any failure
 * that isn't listed in scripts/qa/known-issues.json.
 */
import { readdirSync, statSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

const BASE = (process.env.BASE_URL || "http://localhost:4000").replace(/\/$/, "")
const PW = process.env.TEST_PASSWORD || "Test-Password-123"
const ACCOUNTS = {
  A: process.env.STUDENT_A || "a@test.local",
  B: process.env.STUDENT_B || "b@test.local",
  H: process.env.LEARNER_H || "h@test.local",
  ADMIN: process.env.ADMIN || "admin@test.local",
  SUPER: process.env.SUPERUSER || "super@test.local",
}

const results = []
function record(area, name, ok, detail = "") {
  results.push({ area, name, ok, detail })
}

// --- tiny cookie-aware client ---------------------------------------------------
class Client {
  constructor(label) { this.label = label; this.jar = new Map() }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ") }
  store(res) {
    const set = res.headers.getSetCookie?.() ?? []
    for (const c of set) {
      const [pair] = c.split(";")
      const i = pair.indexOf("=")
      const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim()
      if (v === "" || /max-age=0/i.test(c)) this.jar.delete(k); else this.jar.set(k, v)
    }
    return set
  }
  async req(method, path, { json, form, headers = {}, raw } = {}) {
    const h = { ...headers }
    if (this.jar.size) h.cookie = this.cookieHeader()
    let body
    if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json) }
    if (form) { h["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString() }
    if (raw !== undefined) body = raw
    const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" })
    const setCookies = this.store(res)
    const text = await res.text()
    let data = null
    try { data = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, data, text, headers: res.headers, setCookies }
  }
  async login(email, password = PW) {
    const csrf = await this.req("GET", "/api/auth/csrf")
    const r = await this.req("POST", "/api/auth/callback/credentials", {
      form: { csrfToken: csrf.data?.csrfToken ?? "", email, password, json: "true", callbackUrl: BASE + "/dashboard" },
    })
    const session = await this.req("GET", "/api/auth/session")
    return { ok: !!session.data?.user?.id, session: session.data, res: r }
  }
}

// --- route inventory from the source tree -------------------------------------------
function routes() {
  const root = join(process.cwd(), "src", "app", "api")
  const out = []
  const walk = d => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) walk(p)
      else if (/^route\.tsx?$/.test(f)) {
        const src = readFileSync(p, "utf8")
        const methods = [...src.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)/g)].map(m => m[1])
        const rel = relative(root, d).split(sep).join("/")
        const url = "/api/" + rel.replace(/\[\.\.\.[^\]]+\]/g, "x").replace(/\[[^\]]+\]/g, "does-not-exist")
        out.push({ url, methods, admin: /requireAdmin\(|canManageAdmins\(/.test(src), file: rel })
      }
    }
  }
  walk(root)
  return out
}

// Public by design (no session needed), as "METHOD /path"
const PUBLIC = new Set([
  "GET /api/auth/x", "POST /api/auth/x", "GET /api/auth/session", "POST /api/auth/session",
  "POST /api/auth/register", "POST /api/auth/register/verify", "POST /api/auth/register/resend",
  "POST /api/auth/forgot-password", "POST /api/auth/reset-password", "GET /api/push/public-key", "POST /api/events",
  "POST /api/message", "POST /api/admin/superuser/claim", // disabled: 410
  "GET /api/cron/reminders", // needs CRON_SECRET (tested separately)
  "GET /api/modules", "GET /api/courses", "GET /api/chapters", // public catalogue: titles only
  "POST /api/admin/textbooks/upload", // auth is checked when the upload token is requested (onBeforeGenerateToken)
  "GET /api/health", // uptime and release checks: commit, environment and latest migration only (details need MONITOR_TOKEN)
  "POST /api/client-errors", // browser error reports; size-capped, always 204, groups capped per hour
  "GET /api/cron/daily-digest", // needs CRON_SECRET
])

// Accepted, ticketed failures (scripts/qa/known-issues.json). They're reported as
// KNOWN and don't fail the run, so CI blocks only on NEW problems. A known issue
// that starts passing is reported so it can be removed from the list.
function knownIssues() {
  const file = process.env.KNOWN_ISSUES_FILE || join(process.cwd(), "scripts", "qa", "known-issues.json")
  try { return new Map(JSON.parse(readFileSync(file, "utf8")).map(k => [k.name, k])) } catch { return new Map() }
}

async function main() {
  const anon = new Client("anon")
  const c = {}
  for (const [k, email] of Object.entries(ACCOUNTS)) {
    c[k] = new Client(k)
    const r = await c[k].login(email)
    record("Auth", `${k} can sign in`, r.ok, r.ok ? "" : `status ${r.res.status}`)
  }

  // 1. Session cookie flags
  const login = new Client("flags")
  const csrf = await login.req("GET", "/api/auth/csrf")
  const r = await login.req("POST", "/api/auth/callback/credentials", { form: { csrfToken: csrf.data.csrfToken, email: ACCOUNTS.A, password: PW, json: "true" } })
  const sess = r.setCookies.find(s => /session-token=/.test(s)) || ""
  record("Auth", "Session cookie is HttpOnly", /httponly/i.test(sess), sess.split(";").slice(1).join(";").trim())
  record("Auth", "Session cookie is SameSite=Lax", /samesite=lax/i.test(sess))
  record("Auth", "Session cookie is Secure (production build)", /secure/i.test(sess))

  // 2. Wrong password and brute force
  const bad = new Client("bad")
  const br = await bad.login(ACCOUNTS.A, "wrong-password")
  record("Auth", "Wrong password is refused", !br.ok)
  let refused = 0
  // A dedicated address, so the lockout doesn't block the test accounts on the next run
  for (let i = 0; i < 12; i++) {
    const t = new Client("bf")
    const x = await t.login("bruteforce-target@test.local", "wrong-" + i)
    if (x.res.status === 429) refused++
  }
  record("Auth", "Repeated failed sign-ins are rate-limited", refused > 0, refused ? `${refused} of 12 got 429` : "12 attempts, none limited (TS-008)")

  // 3. Open redirect after sign-in
  const or = new Client("or")
  const ocsrf = await or.req("GET", "/api/auth/csrf")
  const orr = await or.req("POST", "/api/auth/callback/credentials", { form: { csrfToken: ocsrf.data.csrfToken, email: ACCOUNTS.A, password: PW, json: "true", callbackUrl: "https://evil.example/phish" } })
  const target = orr.data?.url || orr.headers.get("location") || ""
  record("Auth", "No open redirect via callbackUrl", !target.includes("evil.example"), target)

  // 4. Unauthenticated sweep of every API route
  const inv = routes()
  let unauthChecked = 0
  for (const rt of inv) {
    for (const m of rt.methods) {
      if (PUBLIC.has(`${m} ${rt.url}`)) continue
      unauthChecked++
      const res = await anon.req(m, rt.url, m === "GET" || m === "DELETE" ? {} : { json: {} })
      const ok = [401, 403, 404, 405, 307, 302].includes(res.status)
      if (!ok) record("Unauthenticated", `${m} ${rt.url}`, false, `status ${res.status}: ${(res.data?.error || res.text).toString().slice(0, 80)}`)
    }
  }
  record("Unauthenticated", `${unauthChecked} protected route/method pairs refuse signed-out callers`, !results.some(x => x.area === "Unauthenticated" && !x.ok))

  // 5. Student calling admin routes
  let adminChecked = 0
  for (const rt of inv.filter(x => x.admin)) {
    for (const m of rt.methods) {
      if (m === "GET" && /\/api\/(topics|chapters|modules|courses|questions|exercises|projects|progress)/.test(rt.url)) continue // shared GETs, checked below
      if (rt.url === "/api/admin/textbooks/upload") continue // token callback checks the role
      adminChecked++
      const res = await c.A.req(m, rt.url, m === "GET" || m === "DELETE" ? {} : { json: {} })
      const ok = [401, 403, 404, 405].includes(res.status)
      if (!ok) record("Student → admin", `${m} ${rt.url}`, false, `status ${res.status}: ${(res.data?.error || res.text).toString().slice(0, 80)}`)
    }
  }
  record("Student → admin", `${adminChecked} admin route/method pairs refuse a student`, !results.some(x => x.area === "Student → admin" && !x.ok))

  // 6. One student reaching another's data (IDOR)
  const idor = [
    ["GET", "/api/quiz/attempt?attemptId=qa_b", null, "read B's quiz attempt"],
    ["PUT", "/api/quiz/attempt", { attemptId: "qa_b", questionId: "q_t1_1", selectedAnswerId: "a_t1_1_a" }, "answer in B's quiz"],
    ["PATCH", "/api/calendar/ev_b", { title: "hacked" }, "edit B's calendar event"],
    ["DELETE", "/api/calendar/ev_b", null, "delete B's calendar event"],
    ["GET", "/api/progress/user/u_b", null, "read B's progress"],
    ["GET", "/api/chat/messages?conversationId=conv_bh", null, "read B and H's chat"],
    ["POST", "/api/chat/messages", { conversationId: "conv_bh", type: "TEXT", content: "hi" }, "post into B and H's chat"],
    ["POST", "/api/chat/read", { conversationId: "conv_bh" }, "mark B and H's chat read"],
  ]
  for (const [m, p, body, label] of idor) {
    const res = await c.A.req(m, p, body ? { json: body } : {})
    record("IDOR (A → B)", `Can't ${label}`, res.status >= 400 && res.status !== 500, `status ${res.status}`)
  }
  const pa = await c.A.req("POST", "/api/pusher/auth", { form: { socket_id: "123.456", channel_name: "private-conversation-conv_bh" } })
  record("IDOR (A → B)", "Can't subscribe to B and H's chat channel", pa.status === 403, `status ${pa.status}`)
  const pu = await c.A.req("POST", "/api/pusher/auth", { form: { socket_id: "123.456", channel_name: "private-user-u_b" } })
  record("IDOR (A → B)", "Can't subscribe to B's private channel", pu.status === 403, `status ${pu.status}`)
  const from = new Date(Date.now() - 86400000).toISOString(), to = new Date(Date.now() + 30 * 86400000).toISOString()
  const ev = await c.B.req("GET", `/api/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
  record("IDOR (A → B)", "B's calendar event still intact", JSON.stringify(ev.data ?? "").includes("B private exam"))

  // 7. Topic locks and quiz integrity
  const lockedTopic = await c.A.req("GET", "/api/topics/t2")
  record("Business rules", "Locked topic can't be opened", lockedTopic.status === 403, `status ${lockedTopic.status}`)
  const lockedQuiz = await c.A.req("POST", "/api/quiz/attempt", { json: { topicId: "t2" } })
  record("Business rules", "Locked topic's quiz can't be started", lockedQuiz.status === 403, `status ${lockedQuiz.status}`)
  const start = await c.A.req("POST", "/api/quiz/attempt", { json: { topicId: "t1", fresh: true } })
  const qs = start.data?.data?.questions ?? []
  record("Quiz integrity", "Quiz starts for an unlocked topic", start.status === 200 && qs.length > 0, `status ${start.status}`)
  record("Quiz integrity", "Questions sent to the browser don't reveal the right answer", !/isCorrect|"correct"/i.test(JSON.stringify(qs)))
  if (qs.length) {
    const wrong = qs[0].options.find(o => !o.id.endsWith("_a"))
    const ans = await c.A.req("PUT", "/api/quiz/attempt", { json: { attemptId: start.data.data.attemptId, questionId: qs[0].id, selectedAnswerId: wrong.id, isCorrect: true } })
    record("Quiz integrity", "Client-sent isCorrect is ignored (marked on the server)", ans.data?.isCorrect === false, `isCorrect=${ans.data?.isCorrect}`)
  }

  // 8. Roles: admin vs superuser, mass assignment
  const promote = await c.ADMIN.req("PATCH", "/api/admin/users/u_a", { json: { role: "ADMIN" } })
  record("Roles", "Ordinary admin can't change roles once a superuser exists", promote.status === 403, `status ${promote.status}`)
  const grant = await c.ADMIN.req("PATCH", "/api/admin/users/u_adm", { json: { isSuperuser: true } })
  record("Roles", "Ordinary admin can't make themselves superuser", grant.status === 403, `status ${grant.status}`)
  const selfDemote = await c.SUPER.req("PATCH", "/api/admin/users/u_su", { json: { role: "STUDENT" } })
  record("Roles", "Superuser can't remove their own admin access", selfDemote.status === 400, `status ${selfDemote.status}`)
  await c.A.req("PATCH", "/api/profile", { json: { role: "ADMIN", isSuperuser: true, name: "Student A" } })
  const me = await c.A.req("GET", "/api/admin/users")
  record("Roles", "Profile update can't set role or superuser (mass assignment)", me.status === 403, `admin list status ${me.status}`)

  // 9. Study level separation
  const hsMods = await c.H.req("GET", "/api/modules")
  const titles = JSON.stringify(hsMods.data ?? "")
  record("Business rules", "High school learner's catalogue has no university modules", !titles.includes("MAT1503"), `status ${hsMods.status}`)
  const hsTopic = await c.H.req("GET", "/api/topics/t1")
  record("Business rules", "High school learner can't open a university topic by id", hsTopic.status >= 400, `status ${hsTopic.status}`)

  // 10. Input handling
  const big = await anon.req("POST", "/api/events", { raw: JSON.stringify({ name: "page_view", props: { x: "y".repeat(6000) } }), headers: { "content-type": "application/json" } })
  record("Input", "Oversized analytics event refused", big.status === 413, `status ${big.status}`)
  const ssrf = await c.A.req("POST", "/api/push/subscribe", { json: { endpoint: "https://169.254.169.254/latest/meta-data", keys: { p256dh: "x", auth: "y" } } })
  record("Input", "Push subscription to a non-push URL refused (SSRF)", ssrf.status === 400, `status ${ssrf.status}`)
  const junk = await c.A.req("POST", "/api/quiz/attempt", { raw: "{not json", headers: { "content-type": "application/json" } })
  record("Input", "Malformed JSON doesn't crash a route (no 500)", junk.status !== 500, `status ${junk.status}`)

  // 11. Cron
  const cron0 = await anon.req("GET", "/api/cron/reminders")
  record("Cron", "Reminders job refuses callers without the secret", cron0.status === 401 || cron0.status === 503, `status ${cron0.status}`)
  if (process.env.CRON_SECRET) {
    const cron1 = await anon.req("GET", "/api/cron/reminders", { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } })
    record("Cron", "Reminders job runs with the secret", cron1.status === 200, `status ${cron1.status}`)
  }

  // 11b. Admin PAGES (not just APIs) must not render for a student (business/12 §3)
  for (const [path, marker] of [["/admin", "Manage modules"], ["/admin/analytics", "Activation"], ["/admin/monitoring", "Open error groups"], ["/admin/feedback", "Last 7 days"]]) {
    const r = await c.A.req("GET", path)
    record("Roles", `Student can't see admin page ${path}`, r.status >= 300 && r.status < 400 && !r.text.includes(marker), `status ${r.status}${r.text.includes(marker) ? ", admin content in the response" : ""}`)
  }
  const adminOk = await c.ADMIN.req("GET", "/admin/monitoring")
  record("Roles", "Admin can open admin pages", adminOk.status === 200 && adminOk.text.includes("Open error groups"), `status ${adminOk.status}`)

  // 12. Account enumeration and XSS on public notes
  const reg = await anon.req("POST", "/api/auth/register", { json: { email: ACCOUNTS.A, password: "Another-Password-1", level: "tertiary" } })
  record("Privacy", "Sign-up doesn't reveal which emails have accounts", reg.status !== 409, `status ${reg.status}: ${reg.data?.error ?? ""}`)
  const f1 = await anon.req("POST", "/api/auth/forgot-password", { json: { email: ACCOUNTS.A } })
  const f2 = await anon.req("POST", "/api/auth/forgot-password", { json: { email: "nobody-here@test.local" } })
  record("Privacy", "Forgot-password gives the same answer for known and unknown emails", f1.status === f2.status && JSON.stringify(f1.data) === JSON.stringify(f2.data), `${f1.status} vs ${f2.status}`)
  const list = await anon.req("GET", "/api/topics?chapterId=c1")
  record("Business rules", "Signed-out visitors can't list lesson text", list.status === 401, `status ${list.status}`)
  const listA = await c.A.req("GET", "/api/topics?chapterId=c1")
  record("Business rules", "Topic list doesn't give students lesson text (locked topics stay locked)", listA.status === 200 && !JSON.stringify(listA.data).includes("Locked topic content"), `status ${listA.status}`)
  const note = await anon.req("GET", "/notes/t1")
  record("XSS", "Public note strips <script>, onerror and javascript: links", note.status === 200 && !/<script>alert|onerror=|javascript:alert/i.test(note.text), `status ${note.status}`)

  // 13. Security headers
  const home = await anon.req("GET", "/")
  for (const [h, label] of [["strict-transport-security", "HSTS"], ["content-security-policy", "Content-Security-Policy"], ["x-content-type-options", "X-Content-Type-Options"], ["referrer-policy", "Referrer-Policy"]]) {
    record("Headers", `${label} header present`, !!home.headers.get(h), home.headers.get(h) ?? "missing (TS-004)")
  }
  record("Headers", "X-Powered-By header removed", !home.headers.get("x-powered-by"), home.headers.get("x-powered-by") ?? "")

  // Report
  const known = knownIssues()
  const width = Math.max(...results.map(r => r.name.length))
  let fails = 0, knownFails = 0
  for (const r of results) {
    const k = known.get(r.name)
    let label = r.ok ? "PASS" : "FAIL"
    if (!r.ok && k) { label = "KNOWN"; knownFails++ } else if (!r.ok) fails++
    if (r.ok && k) label = "FIXED"
    r.status = label
    console.log(`${label.padEnd(5)} ${r.area.padEnd(16)} ${r.name.padEnd(width)}  ${r.detail}${k && !r.ok ? `  [${k.ticket}]` : ""}`)
  }
  const fixed = results.filter(r => r.status === "FIXED").length
  console.log(`\n${results.length - fails - knownFails} passed, ${fails} failed, ${knownFails} known issues${fixed ? `, ${fixed} known issue(s) now pass: remove them from known-issues.json` : ""}`)
  if (process.env.JSON_OUT) (await import("node:fs")).writeFileSync(process.env.JSON_OUT, JSON.stringify(results, null, 2))
  process.exit(fails ? 1 : 0)
}

main().catch(e => { console.error(e); process.exit(2) })
