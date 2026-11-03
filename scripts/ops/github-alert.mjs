#!/usr/bin/env node
/**
 * Turns monitor-result.json into a GitHub issue, so alerts reach you through
 * GitHub's email and mobile notifications, and each incident has a timeline.
 *
 *   GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node scripts/ops/github-alert.mjs monitor-result.json
 *
 * - Problem and no open alert issue → open one (label "incident"), with the details.
 * - Problem and an open issue → comment only when the problems change, so a
 *   long outage doesn't send a notification every hour.
 * - Healthy and an open issue → comment "recovered" and close it.
 * The issue is the incident record: add your notes and the post-incident review there.
 */
import { readFileSync } from "node:fs"

const file = process.argv[2] || "monitor-result.json"
const result = JSON.parse(readFileSync(file, "utf8"))
const API = (process.env.GITHUB_API_URL || "https://api.github.com").replace(/\/$/, "")
const REPO = process.env.GITHUB_REPOSITORY
const TOKEN = process.env.GITHUB_TOKEN
const LABEL = "incident"
const MARK = "<!-- tyro-monitor -->"
if (!REPO || !TOKEN) { console.error("GITHUB_REPOSITORY and GITHUB_TOKEN are required"); process.exit(2) }

async function gh(method, path, body) {
  const res = await fetch(`${API}/repos/${REPO}${path}`, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json", "x-github-api-version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok && res.status !== 422) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

const sast = new Date(result.checkedAt).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg", dateStyle: "medium", timeStyle: "short" })
const problemList = result.problems.map(p => `- ${p}`).join("\n")
const signature = `status=${result.status};${[...result.problems].map(p => p.replace(/\d+/g, "#")).sort().join("|")}`

const open = (await gh("GET", `/issues?state=open&labels=${LABEL}&per_page=20`)).filter(i => i.body?.includes(MARK))
const current = open[0]

if (result.status === "ok") {
  if (current) {
    await gh("POST", `/issues/${current.number}/comments`, { body: `✅ **Recovered** at ${sast} SAST. All checks pass (commit ${result.commit?.slice(0, 7) ?? "?"}).\n\nBefore closing for good: add a short post-incident review below (docs/incidents/TEMPLATE.md) if students were affected.` })
    await gh("PATCH", `/issues/${current.number}`, { state: "closed", state_reason: "completed" })
    console.log(`Closed #${current.number}`)
  } else console.log("OK, nothing to do")
  process.exit(0)
}

const severity = result.status === "down" ? "SEV1 – site down" : "SEV2/3 – degraded"
const body = `${MARK}\n<!-- signature: ${signature} -->\n**${severity}** detected by the monitor at ${sast} SAST on ${result.base}.\n\n${problemList}\n\nNext: follow docs/runbooks/incident-response.md (Admin → Monitoring, Vercel Logs, rollback if needed). The monitor comments here when the problems change and closes this issue when everything passes again.`

if (!current) {
  await gh("POST", "/labels", { name: LABEL, color: "d73a4a", description: "Production incident (opened by the monitor or by hand)" }).catch(() => {})
  const issue = await gh("POST", "/issues", { title: `[${result.status}] ${result.problems[0]?.slice(0, 90) ?? "Production problem"}`, body, labels: [LABEL] })
  console.log(`Opened #${issue.number}`)
} else {
  const comments = await gh("GET", `/issues/${current.number}/comments?per_page=100`)
  const last = [...comments].reverse().find(c => c.body?.includes("signature:"))?.body ?? current.body
  if (!last.includes(`signature: ${signature}`)) {
    await gh("POST", `/issues/${current.number}/comments`, { body: `<!-- signature: ${signature} -->\n**Update ${sast} SAST: ${result.status}**\n\n${problemList}` })
    console.log(`Updated #${current.number}`)
  } else console.log(`Unchanged, #${current.number} still open`)
}
