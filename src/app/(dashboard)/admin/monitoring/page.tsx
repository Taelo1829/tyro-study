import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card } from "@/components/ui/card"
import { ResolveErrorButton } from "@/components/monitoring/resolve-error-button"
import { cn } from "@/lib/utils"
import { flagSettings } from "@/lib/flags"
import { VITAL_TARGETS, formatVital, opsReport, vitalOk } from "@/lib/ops-report"
import { requireAdminPage } from "@/lib/admin"

export const dynamic = "force-dynamic"

/**
 * Production health for admins: errors grouped by cause, scheduled jobs,
 * real-user performance and activity. The incident runbook
 * (docs/runbooks/incident-response.md) starts here.
 */

const when = new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" })
const ago = (d: Date | null, now: number) => {
  if (!d) return "never"
  const m = Math.round((now - new Date(d).getTime()) / 60000)
  if (m < 60) return `${m} min ago`
  if (m < 48 * 60) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}

export default async function MonitoringPage() {
  await requireAdminPage()
  const r = await opsReport()
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local"
  const flags = flagSettings()
  const now = r.generatedAt.getTime()
  const dayAgo = now - 24 * 3600 * 1000
  const stale = r.heartbeats.filter(h => h.stale)

  return (
    <>
      <Header title="Monitoring" subtitle="Is Tyro working for students right now?" />
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin" className="text-muted-foreground hover:underline">← Admin</Link>
        <span className="text-muted-foreground">Commit {commit} · {process.env.VERCEL_ENV ?? "local"} · updated {when.format(r.generatedAt)}</span>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label="Open error groups (7 days)" value={r.errors.openGroups} bad={r.errors.newLastHour > 0} note={`${r.errors.newLastHour} new in the last hour`} />
          <Tile label="Errors active in 24 h" value={r.errors.activeLastDay} bad={r.errors.activeLastHour > 0} note={`${r.errors.activeLastHour} in the last hour`} />
          <Tile label="Scheduled jobs" value={stale.length ? `${stale.length} late` : "OK"} bad={stale.length > 0} note={r.heartbeats.map(h => h.name.replace("cron:", "")).join(", ")} />
          <Tile label="Active students (24 h)" value={r.activity24h.activeStudents} note={`${r.activity24h.quizzesCompleted} quizzes, ${r.activity24h.signUps} sign-ups`} />
        </div>

        <Card>
          <h2 className="mb-3 text-lg font-semibold">Errors</h2>
          {r.errorGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open errors in the last 7 days.</p>
          ) : (
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Error groups">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="py-2 pr-3">Error</th><th className="pr-3">Where</th><th className="pr-3">Count</th><th className="pr-3">Last seen</th><th /></tr>
                </thead>
                <tbody>
                  {r.errorGroups.map(g => (
                    <tr key={g.fingerprint} className="border-t align-top">
                      <td className="py-2 pr-3">
                        {new Date(g.firstSeenAt).getTime() > dayAgo && <span className="mr-1 rounded bg-red-100 px-1.5 text-xs font-medium text-red-900">new</span>}
                        <span className="break-words">{g.message}</span>
                        <div className="text-xs text-muted-foreground">
                          {g.source} · first {when.format(new Date(g.firstSeenAt))}
                          {g.sampleRequestId && <> · request <code>{g.sampleRequestId}</code></>}
                          {g.digest && <> · digest <code>{g.digest}</code></>}
                        </div>
                      </td>
                      <td className="pr-3"><code className="text-xs">{g.route ?? "?"}</code></td>
                      <td className="pr-3 tabular-nums">{g.count}</td>
                      <td className="whitespace-nowrap pr-3">{ago(g.lastSeenAt, now)}</td>
                      <td className="py-2"><ResolveErrorButton fingerprint={g.fingerprint} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Search Vercel → Logs for the request id (logs are kept for 1 hour on the Hobby plan). Resolved errors reopen if they happen again.
          </p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 text-lg font-semibold">Real-user performance (p75, 7 days)</h2>
            {r.vitals.overall.length === 0 ? (
              <p className="text-sm text-muted-foreground">No samples yet. Half of page loads report LCP, INP, CLS, FCP and TTFB.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {r.vitals.overall.map(v => (
                  <li key={v.metric} className="flex justify-between gap-3">
                    <span>{v.metric} <span className="text-xs text-muted-foreground">({v.samples} samples)</span></span>
                    <span className={cn("font-medium tabular-nums", vitalOk(v.metric, v.p75) ? "text-emerald-700" : "text-red-700")}>
                      {formatVital(v.metric, v.p75)}
                      {VITAL_TARGETS[v.metric] && <span className="ml-1 text-xs font-normal text-muted-foreground">target ≤ {formatVital(v.metric, VITAL_TARGETS[v.metric].good)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {r.vitals.slowestPages.length > 0 && (
              <>
                <h3 className="mb-1 mt-4 text-sm font-semibold">Slowest pages (LCP)</h3>
                <ul className="space-y-1 text-sm">
                  {r.vitals.slowestPages.map(p => (
                    <li key={p.route} className="flex justify-between gap-3"><code className="text-xs">{p.route}</code><span className="tabular-nums">{formatVital("LCP", p.p75)}</span></li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 text-lg font-semibold">Scheduled jobs</h2>
            <ul className="space-y-2 text-sm">
              {r.heartbeats.map(h => (
                <li key={h.name}>
                  <div className="flex justify-between gap-3">
                    <code className="text-xs">{h.name}</code>
                    <span className={cn("font-medium", h.stale ? "text-red-700" : "text-emerald-700")}>{h.stale ? "Late" : "OK"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last success {ago(h.lastOkAt, now)} (allowed: {h.limitMinutes >= 120 ? `${Math.round(h.limitMinutes / 60)} h` : `${h.limitMinutes} min`})
                    {h.lastError && <> · last error: {h.lastError}</>}
                  </p>
                </li>
              ))}
            </ul>
            <h3 className="mb-1 mt-4 text-sm font-semibold">Feature flags</h3>
            <ul className="text-xs text-muted-foreground">
              {flags.map(f => <li key={f.flag}><code>{f.flag}</code> = {f.value} ({f.source})</li>)}
            </ul>
          </Card>
        </div>

        <Card>
          <h2 className="mb-2 text-lg font-semibold">When something is wrong</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Follow <code>docs/runbooks/incident-response.md</code>: decide the severity, then mitigate first (rollback, kill switch).</li>
            <li>Vercel → Project → Logs (last hour) and Observability (errors, function duration).</li>
            <li>Neon console → Monitoring (connections, CPU) if the database is slow or down.</li>
            <li>Tell students if they&apos;re affected: <code>STATUS_MESSAGE</code> banner and the WhatsApp/socials template.</li>
          </ol>
        </Card>
      </div>
    </>
  )
}

function Tile({ label, value, note, bad }: { label: string; value: string | number; note?: string; bad?: boolean }) {
  return (
    <Card className={cn(bad && "ring-2 ring-red-300")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", bad && "text-red-700")}>{value}</p>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
    </Card>
  )
}
