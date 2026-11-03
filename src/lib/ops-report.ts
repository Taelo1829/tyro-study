/**
 * Numbers for Admin → Monitoring and the daily ops email: performance from
 * real students (web_vital events), activity, errors and job heartbeats.
 * All read-only SQL; every query falls back to empty so the page still renders
 * if a table is missing.
 */
import { prisma } from "@/lib/prisma"
import { feedbackCounts } from "@/lib/feedback"
import { HEARTBEAT_LIMITS, errorSummary, isStale, listErrorGroups, listHeartbeats, type ErrorGroupRow } from "@/lib/monitoring"

/** Targets at the 75th percentile (Core Web Vitals "good" thresholds; business/02 NFR-01). */
export const VITAL_TARGETS: Record<string, { good: number; unit: "ms" | "" }> = {
  LCP: { good: 2500, unit: "ms" },
  INP: { good: 200, unit: "ms" },
  CLS: { good: 0.1, unit: "" },
  FCP: { good: 1800, unit: "ms" },
  TTFB: { good: 800, unit: "ms" },
}

export interface VitalRow { metric: string; route: string | null; samples: number; p75: number }

/** p75 per metric overall (route null) and for the slowest pages. */
export async function webVitals(days = 7): Promise<{ overall: VitalRow[]; slowestPages: VitalRow[] }> {
  try {
    const overall = await prisma.$queryRaw<VitalRow[]>`
      SELECT props->>'metric' AS metric, NULL::text AS route, COUNT(*)::int AS samples,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'value')::float8) AS p75
      FROM "analytics_events"
      WHERE "name" = 'web_vital' AND "createdAt" > NOW() - make_interval(days => ${days}::int)
      GROUP BY 1 ORDER BY 1`
    const slowestPages = await prisma.$queryRaw<VitalRow[]>`
      SELECT 'LCP' AS metric, props->>'route' AS route, COUNT(*)::int AS samples,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY (props->>'value')::float8) AS p75
      FROM "analytics_events"
      WHERE "name" = 'web_vital' AND props->>'metric' = 'LCP'
        AND "createdAt" > NOW() - make_interval(days => ${days}::int)
      GROUP BY 2 HAVING COUNT(*) >= 10
      ORDER BY p75 DESC LIMIT 5`
    const fix = (r: VitalRow) => ({ ...r, samples: Number(r.samples), p75: Number(r.p75) })
    return { overall: overall.map(fix), slowestPages: slowestPages.map(fix) }
  } catch {
    return { overall: [], slowestPages: [] }
  }
}

export interface Activity { activeStudents: number; signUps: number; quizzesCompleted: number; answers: number }

/** Activity in the last `hours` (admins included; this is an ops signal, not a product metric). */
export async function activity(hours = 24): Promise<Activity> {
  const empty = { activeStudents: 0, signUps: 0, quizzesCompleted: 0, answers: 0 }
  try {
    const [ev] = await prisma.$queryRaw<{ active: number; sign_ups: number; quizzes: number }[]>`
      SELECT COUNT(DISTINCT "userId")::int AS active,
             COUNT(*) FILTER (WHERE "name" = 'sign_up')::int AS sign_ups,
             COUNT(*) FILTER (WHERE "name" = 'quiz_completed')::int AS quizzes
      FROM "analytics_events"
      WHERE "createdAt" > NOW() - make_interval(hours => ${hours}::int)`
    const [ans] = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM "user_answers" WHERE "answeredAt" > NOW() - make_interval(hours => ${hours}::int)`
    return { activeStudents: Number(ev?.active ?? 0), signUps: Number(ev?.sign_ups ?? 0), quizzesCompleted: Number(ev?.quizzes ?? 0), answers: Number(ans?.n ?? 0) }
  } catch {
    return empty
  }
}

export interface HeartbeatStatus { name: string; lastOkAt: Date | null; lastError: string | null; minutesSinceOk: number | null; limitMinutes: number; stale: boolean }

export async function heartbeatStatus(): Promise<HeartbeatStatus[]> {
  const rows = await listHeartbeats()
  const now = Date.now()
  return Object.entries(HEARTBEAT_LIMITS).map(([name, limit]) => {
    const row = rows.find(r => r.name === name)
    const minutesSinceOk = row?.lastOkAt ? Math.round((now - new Date(row.lastOkAt).getTime()) / 60000) : null
    return { name, lastOkAt: row?.lastOkAt ?? null, lastError: row?.lastError ?? null, minutesSinceOk, limitMinutes: limit.minutes, stale: isStale(name, minutesSinceOk) }
  })
}

export interface OpsReport {
  generatedAt: Date
  errors: Awaited<ReturnType<typeof errorSummary>>
  errorGroups: ErrorGroupRow[]
  heartbeats: HeartbeatStatus[]
  activity24h: Activity
  vitals: Awaited<ReturnType<typeof webVitals>>
  feedback24h: { kind: string; status: string; n: number }[]
}

export async function opsReport(): Promise<OpsReport> {
  const [errors, errorGroups, heartbeats, activity24h, vitals, feedback24h] = await Promise.all([
    errorSummary(),
    listErrorGroups(24 * 7),
    heartbeatStatus(),
    activity(24),
    webVitals(7),
    feedbackCounts(1),
  ])
  return { generatedAt: new Date(), errors, errorGroups, heartbeats, activity24h, vitals, feedback24h }
}

export function formatVital(metric: string, value: number): string {
  if (metric === "CLS") return value.toFixed(2)
  return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`
}

export function vitalOk(metric: string, value: number): boolean {
  const t = VITAL_TARGETS[metric]
  return !t || value <= t.good
}

/** Plain-text daily email. Things that need attention come first. */
export function digestText(r: OpsReport, siteUrl: string): { subject: string; text: string; needsAttention: boolean } {
  const day = new Date(Date.now() - 24 * 3600 * 1000)
  const newGroups = r.errorGroups.filter(g => new Date(g.firstSeenAt) > day)
  const activeGroups = r.errorGroups.filter(g => new Date(g.lastSeenAt) > day)
  const stale = r.heartbeats.filter(h => h.stale && h.name !== "cron:daily-digest")
  const slowVitals = r.vitals.overall.filter(v => ["LCP", "INP", "CLS"].includes(v.metric) && v.samples >= 20 && !vitalOk(v.metric, v.p75))
  const needsAttention = newGroups.length > 0 || stale.length > 0 || slowVitals.length > 0

  const lines: string[] = []
  lines.push(needsAttention ? "NEEDS ATTENTION" : "All quiet.", "")
  if (stale.length) {
    lines.push("Scheduled jobs not running:")
    for (const h of stale) lines.push(`  - ${h.name}: last success ${h.minutesSinceOk === null ? "never" : `${h.minutesSinceOk} min ago`} (limit ${h.limitMinutes} min)${h.lastError ? `, last error: ${h.lastError}` : ""}`)
    lines.push("")
  }
  lines.push(`Errors in the last 24 hours: ${activeGroups.length} group(s), ${newGroups.length} new.`)
  for (const g of activeGroups.slice(0, 8)) {
    lines.push(`  - ${new Date(g.firstSeenAt) > day ? "[NEW] " : ""}${g.message} (${g.route ?? "?"}, ${g.count}x total, ${g.source})`)
  }
  lines.push("")
  const a = r.activity24h
  lines.push(`Activity (24 h): ${a.activeStudents} active, ${a.signUps} sign-ups, ${a.quizzesCompleted} quizzes completed, ${a.answers} answers.`)
  const fb = r.feedback24h.reduce((n, f) => n + f.n, 0)
  if (fb) lines.push(`Feedback (24 h): ${fb} new (${r.feedback24h.map(f => `${f.n} ${f.kind}`).join(", ")}). Triage: ${siteUrl}/admin/feedback`)
  lines.push("")
  if (r.vitals.overall.length) {
    lines.push("Real-user performance, p75 over 7 days (target):")
    for (const v of r.vitals.overall) {
      const t = VITAL_TARGETS[v.metric]
      lines.push(`  - ${v.metric}: ${formatVital(v.metric, v.p75)}${t ? ` (≤ ${formatVital(v.metric, t.good)})` : ""}${vitalOk(v.metric, v.p75) ? "" : "  SLOW"}  [${v.samples} samples]`)
    }
    lines.push("")
  }
  lines.push(`Details: ${siteUrl}/admin/monitoring`)
  const subject = `Tyro ops: ${needsAttention ? "needs attention" : "all quiet"} (${a.activeStudents} active, ${activeGroups.length} error groups)`
  return { subject, text: lines.join("\n"), needsAttention }
}
