/**
 * Fixed-window rate limiting in Postgres (table rate_limits), so limits hold
 * across Vercel's many function instances without another service.
 *
 *   if (await isLimited(key, rule)) → refuse
 *   await hit(key, rule)            → count an attempt (one statement)
 *
 * Keys are hashed, so emails and IP addresses aren't stored (POPIA).
 * If the table is missing or the database errors, limits fail OPEN: a
 * monitoring hiccup must not lock every student out.
 */
import { createHash } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { log } from "@/lib/log"

export interface LimitRule { limit: number; windowSeconds: number }

/** Sign-in: wrong passwords per email and per network address (UNISA students share campus networks, so IP is generous). */
export const LOGIN_PER_EMAIL: LimitRule = { limit: 8, windowSeconds: 15 * 60 }
export const LOGIN_PER_IP: LimitRule = { limit: 60, windowSeconds: 15 * 60 }
/** "You already have an account" emails from the sign-up form, per address. */
export const SIGNUP_NOTICE_PER_EMAIL: LimitRule = { limit: 2, windowSeconds: 60 * 60 }

export function limitKey(kind: string, value: string): string {
  const salt = process.env.NEXTAUTH_SECRET ?? ""
  return `${kind}:${createHash("sha256").update(`${salt}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32)}`
}

/** Counts one attempt and returns the count in the current window. */
export async function hit(key: string, rule: LimitRule): Promise<number> {
  try {
    const [row] = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "rate_limits" ("key", "windowStart", "count")
      VALUES (${key}, (NOW() AT TIME ZONE 'UTC'), 1)
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "rate_limits"."windowStart" < (NOW() AT TIME ZONE 'UTC') - make_interval(secs => ${rule.windowSeconds}::int)
                       THEN 1 ELSE "rate_limits"."count" + 1 END,
        "windowStart" = CASE WHEN "rate_limits"."windowStart" < (NOW() AT TIME ZONE 'UTC') - make_interval(secs => ${rule.windowSeconds}::int)
                       THEN (NOW() AT TIME ZONE 'UTC') ELSE "rate_limits"."windowStart" END
      RETURNING "count"`
    return Number(row?.count ?? 0)
  } catch (err) {
    log.warn("rate_limit.hit_failed", { err })
    return 0
  }
}

/** Seconds until the key may try again (0 = not limited). */
export async function retryAfter(key: string, rule: LimitRule): Promise<number> {
  try {
    const [row] = await prisma.$queryRaw<{ count: number; remaining: number }[]>`
      SELECT "count",
             EXTRACT(EPOCH FROM ("windowStart" + make_interval(secs => ${rule.windowSeconds}::int) - (NOW() AT TIME ZONE 'UTC')))::int AS remaining
      FROM "rate_limits" WHERE "key" = ${key}`
    if (!row || Number(row.remaining) <= 0 || Number(row.count) < rule.limit) return 0
    return Number(row.remaining)
  } catch (err) {
    log.warn("rate_limit.check_failed", { err })
    return 0
  }
}

/** Clears a key (e.g. after a successful sign-in). */
export async function clearLimit(key: string) {
  try {
    await prisma.$executeRaw`DELETE FROM "rate_limits" WHERE "key" = ${key}`
  } catch {
    /* fail open */
  }
}

/** Deletes expired windows; called from the daily job. */
export async function pruneRateLimits(olderThanSeconds = 24 * 3600) {
  try {
    return await prisma.$executeRaw`DELETE FROM "rate_limits" WHERE "windowStart" < (NOW() AT TIME ZONE 'UTC') - make_interval(secs => ${olderThanSeconds}::int)`
  } catch {
    return 0
  }
}

/** First address in X-Forwarded-For (Vercel sets it), else X-Real-IP. */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined>): string {
  const get = (k: string) => {
    const v = headers instanceof Headers ? headers.get(k) : headers[k]
    return Array.isArray(v) ? v[0] : v ?? ""
  }
  return (get("x-forwarded-for").split(",")[0] || get("x-real-ip") || "unknown").trim()
}
