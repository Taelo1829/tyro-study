import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { flagSettings } from "@/lib/flags"
import { HEARTBEAT_LIMITS, errorSummary, isStale, listHeartbeats } from "@/lib/monitoring"

/**
 * Health check for uptime monitors and the release workflow.
 *
 *   GET /api/health  →  200 { ok, commit, env, migration, flags }   or 503 when the database is down
 *
 * Public by design. Returns no personal data: only the deployed commit, the
 * Vercel environment name, the newest applied migration and the feature flag
 * settings, so a release can confirm the right code is live on the right
 * schema with the intended flags.
 *
 * With `Authorization: Bearer <MONITOR_TOKEN>` it also returns `details`:
 * database latency, error counts and scheduled-job heartbeats, used by the
 * monitor workflow (scripts/ops/monitor.mjs). Without the token those stay hidden.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? "local"
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"
  const headers = { "Cache-Control": "no-store" }
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    return NextResponse.json({ ok: false, commit, env, error: "database unavailable" }, { status: 503, headers })
  }
  const dbMs = Math.round(performance.now() - started)
  // Newest applied migration. Null where the schema came from `prisma db push`
  // (no _prisma_migrations table), which is fine for local development.
  const migration = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY migration_name DESC LIMIT 1`
    .then(rows => rows[0]?.migration_name ?? null)
    .catch(() => null)
  const flags = Object.fromEntries(flagSettings().map(f => [f.flag, f.value]))
  const body: Record<string, unknown> = { ok: true, commit, env, migration, flags }

  const token = process.env.MONITOR_TOKEN
  if (token && request.headers.get("authorization") === `Bearer ${token}`) {
    const [errors, beats] = await Promise.all([errorSummary(), listHeartbeats()])
    const now = Date.now()
    body.details = {
      dbMs,
      errors,
      heartbeats: Object.entries(HEARTBEAT_LIMITS).map(([name, limit]) => {
        const row = beats.find(b => b.name === name)
        const lastOk = row?.lastOkAt ? new Date(row.lastOkAt).getTime() : null
        const minutesSinceOk = lastOk ? Math.round((now - lastOk) / 60000) : null
        return {
          name,
          lastRunAt: row?.lastRunAt ?? null,
          lastOkAt: row?.lastOkAt ?? null,
          lastError: row?.lastError ?? null,
          minutesSinceOk,
          limitMinutes: limit.minutes,
          stale: isStale(name, minutesSinceOk),
        }
      }),
    }
  }
  return NextResponse.json(body, { headers })
}
