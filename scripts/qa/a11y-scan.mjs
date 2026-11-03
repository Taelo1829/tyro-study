#!/usr/bin/env node
/**
 * Accessibility and browser checks with Playwright + axe-core (WCAG 2.2 A/AA rules).
 *
 *   BASE_URL=http://localhost:4000 TEST_PASSWORD='...' node scripts/qa/a11y-scan.mjs
 *
 * Signs in as the seeded test student and admin (scripts/qa/seed-test-data.mjs),
 * opens each key page at phone (390 px) and desktop (1280 px) width, and reports:
 *  - axe violations (rule, impact, how many elements)
 *  - horizontal scrolling at phone width
 *  - whether pinch-zoom is allowed (viewport meta)
 *  - JavaScript errors and dialogs (e.g. an XSS alert) while the page loads
 * Writes the full result to a11y-results.json. Needs: npm i -D axe-core playwright
 */
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { chromium } = require("playwright")
const AXE = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8")
const BASE = (process.env.BASE_URL || "http://localhost:4000").replace(/\/$/, "")
const PW = process.env.TEST_PASSWORD || "Test-Password-123"

const PAGES = {
  public: ["/", "/notes", "/notes/t1", "/login", "/register", "/about", "/privacy"],
  student: ["/dashboard", "/modules", "/modules/m1", "/modules/m1/chapters/c1", "/modules/m1/topics/t1", "/modules/m1/topics/t1/quiz", "/timetable", "/chat", "/profile", "/feedback"],
  admin: ["/admin", "/admin/analytics", "/admin/modules", "/admin/users", "/admin/monitoring", "/admin/feedback"],
}
const VIEWPORTS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } }

async function signIn(context, email) {
  const csrf = await (await context.request.get(`${BASE}/api/auth/csrf`)).json()
  await context.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { csrfToken: csrf.csrfToken, email, password: PW, json: "true" },
  })
}

const browser = await chromium.launch()
const out = []
for (const [who, paths] of Object.entries(PAGES)) {
  for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...(vpName === "phone" ? { isMobile: true, hasTouch: true } : {}) })
    if (who === "student") await signIn(context, process.env.STUDENT_A || "a@test.local")
    if (who === "admin") await signIn(context, process.env.ADMIN || "admin@test.local")
    for (const path of paths) {
      const page = await context.newPage()
      const jsErrors = [], dialogs = []
      page.on("pageerror", e => jsErrors.push(String(e.message).slice(0, 160)))
      page.on("dialog", async d => { dialogs.push(d.message()); await d.dismiss() })
      const res = await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(e => ({ status: () => `ERR ${e.message.slice(0, 60)}` }))
      await page.waitForTimeout(500)
      await page.addScriptTag({ content: AXE })
      const axe = await page.evaluate(async () =>
        (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } })).violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") }))
      )
      const layout = await page.evaluate(() => ({
        hScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
        viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
        url: location.pathname,
      }))
      out.push({ who, viewport: vpName, path, finalPath: layout.url, status: res.status(), axe, hScroll: layout.hScroll, viewportMeta: layout.viewport, jsErrors, dialogs })
      await page.close()
    }
    await context.close()
  }
}
await browser.close()
writeFileSync("a11y-results.json", JSON.stringify(out, null, 2))

for (const r of out) {
  const v = r.axe.map(a => `${a.id}(${a.impact},${a.nodes})`).join(" ")
  console.log(`${r.who.padEnd(7)} ${r.viewport.padEnd(7)} ${r.path.padEnd(28)} ${String(r.status).padEnd(4)} ${r.finalPath !== r.path ? "→" + r.finalPath + " " : ""}${r.hScroll ? "H-SCROLL " : ""}${r.dialogs.length ? "DIALOG:" + r.dialogs.join("|") + " " : ""}${r.jsErrors.length ? "JSERR " : ""}${v || "no axe violations"}`)
}
const zoomBlocked = out.some(r => /user-scalable=no|maximum-scale=1(\D|$)/i.test(r.viewportMeta))
console.log(`\nPinch-zoom blocked by viewport meta: ${zoomBlocked ? "YES (WCAG 1.4.4 fail)" : "no"}`)
