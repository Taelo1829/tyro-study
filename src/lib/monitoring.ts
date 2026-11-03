/**
 * Production error tracking and job heartbeats, stored in our own Postgres
 * (tables error_events and app_heartbeats, migration 20261030090000).
 *
 * Why not only Vercel logs: Hobby keeps them for 1 hour. Errors are grouped
 * by a fingerprint (kind of error + where it happened, with ids and numbers
 * stripped), so a thousand repeats are one row with count 1000.
 *
 * Every function here swallows its own failures: monitoring must never break
 * the request it's observing, and if the database is down the error still
 * reaches the logs.
 */
import { createHash } from "node:crypto"
import { after } from "next/server"
import { prisma } from "@/lib/prisma"
import { firstLine, log, redact } from "@/lib/log"
export { routeTemplate } from "@/lib/route-template"

export type ErrorSource = "server" | "client"

/** Normalises a message so the same bug always gets the same fingerprint. */
export function normaliseMessage(message: string): string {
  return redact(firstLine(message))
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<uuid>")
    .replace(/\bc[a-z0-9]{20,}\b/g, "<id>") // cuid
    .replace(/\b\d+(\.\d+)?\b/g, "<n>")
    .replace(/(["'`]).{1,80}?\1/g, "$1…$1") // quoted values (names, ids, inputs)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300)
}

export function fingerprint(source: ErrorSource, name: string, message: string, route: string | null): string {
  return createHash("sha256").update([source, name, normaliseMessage(message), route ?? ""].join("|")).digest("hex").slice(0, 32)
}

/** New error groups allowed per hour before we stop adding rows (protects the table from floods). */
const MAX_NEW_GROUPS_PER_HOUR = 200

export interface RecordErrorInput {
  source: ErrorSource
  name?: string
  message: string
  route?: string | null
  requestId?: string | null
  digest?: string | null
}

/** Records one occurrence. Returns the fingerprint, or null if it couldn't be stored. */
export async function recordError(input: RecordErrorInput): Promise<string | null> {
  const name = (input.name || "Error").slice(0, 80)
  const route = input.route ?? null
  const fp = fingerprint(input.source, name, input.message, route)
  const message = `${name}: ${redact(firstLine(input.message))}`.slice(0, 500)
  try {
    // Existing group: bump it (and reopen if it was resolved).
    const updated = await prisma.$executeRaw`
      UPDATE "error_events"
      SET "count" = "count" + 1, "lastSeenAt" = NOW(), "resolvedAt" = NULL,
          "sampleRequestId" = COALESCE(${input.requestId ?? null}, "sampleRequestId"),
          "digest" = COALESCE(${input.digest ?? null}, "digest")
      WHERE "fingerprint" = ${fp}`
    if (updated > 0) return fp

    const [recent] = await prisma.$queryRaw<{ n: bigint | number }[]>`
      SELECT COUNT(*) AS n FROM "error_events" WHERE "firstSeenAt" > NOW() - INTERVAL '1 hour'`
    if (Number(recent?.n ?? 0) >= MAX_NEW_GROUPS_PER_HOUR) {
      log.warn("monitoring.error_groups_capped", { fingerprint: fp })
      return null
    }
    await prisma.$executeRaw`
      INSERT INTO "error_events" ("fingerprint", "source", "message", "route", "sampleRequestId", "digest")
      VALUES (${fp}, ${input.source}, ${message}, ${route}, ${input.requestId ?? null}, ${input.digest ?? null})
      ON CONFLICT ("fingerprint") DO UPDATE SET "count" = "error_events"."count" + 1, "lastSeenAt" = NOW(), "resolvedAt" = NULL`
    return fp
  } catch (err) {
    log.warn("monitoring.record_error_failed", { err, fingerprint: fp })
    return null
  }
}

/** Marks a scheduled job as having run. `ok: false` keeps lastOkAt so staleness still shows. */
export async function heartbeat(name: string, result: { ok: boolean; error?: unknown; details?: Record<string, unknown> }) {
  const error = result.ok ? null : redact(String(result.error instanceof Error ? result.error.message : result.error ?? "failed")).slice(0, 500)
  const details = result.details ? JSON.stringify(result.details) : null
  try {
    await prisma.$executeRaw`
      INSERT INTO "app_heartbeats" ("name", "lastRunAt", "lastOkAt", "lastError", "details")
      VALUES (${name}, NOW(), ${result.ok ? new Date() : null}, ${error}, ${details}::jsonb)
      ON CONFLICT ("name") DO UPDATE SET
        "lastRunAt" = NOW(),
        "lastOkAt" = CASE WHEN ${result.ok}::boolean THEN NOW() ELSE "app_heartbeats"."lastOkAt" END,
        "lastError" = ${error},
        "details" = ${details}::jsonb`
  } catch (err) {
    log.warn("monitoring.heartbeat_failed", { err, name })
  }
}

export interface HeartbeatRow { name: string; lastRunAt: Date; lastOkAt: Date | null; lastError: string | null; details: unknown }
export interface ErrorGroupRow {
  fingerprint: string; source: string; message: string; route: string | null; sampleRequestId: string | null
  digest: string | null; count: number; firstSeenAt: Date; lastSeenAt: Date; resolvedAt: Date | null
}

export async function listHeartbeats(): Promise<HeartbeatRow[]> {
  try {
    return await prisma.$queryRaw<HeartbeatRow[]>`SELECT * FROM "app_heartbeats" ORDER BY "name"`
  } catch {
    return []
  }
}

/** Error groups seen in the last `hours`, newest first. */
export async function listErrorGroups(hours = 24 * 7, includeResolved = false): Promise<ErrorGroupRow[]> {
  try {
    const rows = await prisma.$queryRaw<ErrorGroupRow[]>`
      SELECT * FROM "error_events"
      WHERE "lastSeenAt" > NOW() - make_interval(hours => ${hours}::int)
        AND (${includeResolved}::boolean OR "resolvedAt" IS NULL)
      ORDER BY "lastSeenAt" DESC
      LIMIT 100`
    return rows.map(r => ({ ...r, count: Number(r.count) }))
  } catch {
    return []
  }
}

export async function resolveErrorGroup(fp: string) {
  await prisma.$executeRaw`UPDATE "error_events" SET "resolvedAt" = NOW() WHERE "fingerprint" = ${fp}`
}

/** Counts for health checks and the digest: groups and occurrences in the last hour / day. */
export async function errorSummary(): Promise<{ newLastHour: number; activeLastHour: number; activeLastDay: number; openGroups: number }> {
  try {
    const [r] = await prisma.$queryRaw<{ new_h: bigint; active_h: bigint; active_d: bigint; open: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "firstSeenAt" > NOW() - INTERVAL '1 hour') AS new_h,
        COUNT(*) FILTER (WHERE "lastSeenAt" > NOW() - INTERVAL '1 hour') AS active_h,
        COUNT(*) FILTER (WHERE "lastSeenAt" > NOW() - INTERVAL '1 day') AS active_d,
        COUNT(*) FILTER (WHERE "resolvedAt" IS NULL AND "lastSeenAt" > NOW() - INTERVAL '7 days') AS open
      FROM "error_events"`
    return { newLastHour: Number(r?.new_h ?? 0), activeLastHour: Number(r?.active_h ?? 0), activeLastDay: Number(r?.active_d ?? 0), openGroups: Number(r?.open ?? 0) }
  } catch {
    return { newLastHour: 0, activeLastHour: 0, activeLastDay: 0, openGroups: 0 }
  }
}

/**
 * Jobs and how stale they may get before monitoring complains (minutes).
 * `required`: alert even if it has never run (the reminders scheduler must be
 * set up); otherwise "never ran" is fine until the first run (new deployments).
 */
export const HEARTBEAT_LIMITS: Record<string, { minutes: number; required: boolean }> = {
  "cron:reminders": { minutes: Number(process.env.REMINDERS_STALE_MINUTES) || 30, required: true },
  "cron:daily-digest": { minutes: 26 * 60, required: false },
}

/** Whether a job is late, given minutes since its last success (null = never succeeded). */
export function isStale(name: string, minutesSinceOk: number | null): boolean {
  const limit = HEARTBEAT_LIMITS[name]
  if (!limit) return false
  return minutesSinceOk === null ? limit.required : minutesSinceOk > limit.minutes
}

/**
 * For errors a route catches itself (and answers 500): onRequestError never
 * sees those, so call this from the catch block.
 *
 *   } catch (err) {
 *     captureError("Generate lesson error", err, "/api/ai/generate-lesson")
 *     return NextResponse.json({ error: "…" }, { status: 500 })
 *   }
 *
 * Logs now; stores the error group after the response is sent.
 */
export function captureError(label: string, err: unknown, route: string, requestId?: string | null) {
  log.error("handled.error", { label, route, err, requestId })
  const error = err instanceof Error ? err : new Error(String(err))
  const store = () => recordError({ source: "server", name: error.name, message: `${label}: ${error.message}`, route, requestId }).then(() => undefined)
  try {
    after(store)
  } catch {
    void store() // outside a request (scripts, tests)
  }
}

/** Housekeeping for the daily job: forget error groups not seen for `days` days. */
export async function pruneErrorGroups(days = 90): Promise<number> {
  try {
    return await prisma.$executeRaw`DELETE FROM "error_events" WHERE "lastSeenAt" < NOW() - make_interval(days => ${days}::int)`
  } catch {
    return 0
  }
}
