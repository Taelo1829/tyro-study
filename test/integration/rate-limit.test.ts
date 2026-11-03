/** Integration test: fixed-window rate limits against PGlite with the real migration. */
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"
import { clearLimit, clientIp, hit, limitKey, pruneRateLimits, retryAfter } from "@/lib/rate-limit"

const db = new PGlite()
const run = async (s: TemplateStringsArray, ...v: unknown[]) => { const q = Prisma.sql(s, ...v); return db.query(q.text, q.values as unknown[]) }
const RULE = { limit: 3, windowSeconds: 900 }

beforeAll(async () => {
  await db.exec("SET TIME ZONE 'UTC';")
  await db.exec(readFileSync("prisma/migrations/20261030120000_rate_limits/migration.sql", "utf8"))
  Object.assign(prisma, {
    $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).rows,
    $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).affectedRows ?? 0,
  })
})
beforeEach(async () => { await db.exec(`DELETE FROM "rate_limits"`) })

describe("rate limits", () => {
  it("limits after the allowed number of attempts and tells how long to wait", async () => {
    const key = limitKey("login:email", "Thabo@Example.com")
    for (let i = 1; i <= 2; i++) expect(await hit(key, RULE)).toBe(i)
    expect(await retryAfter(key, RULE)).toBe(0)
    await hit(key, RULE)
    const wait = await retryAfter(key, RULE)
    expect(wait).toBeGreaterThan(890)
    expect(wait).toBeLessThanOrEqual(900)
  })

  it("starts a new window once the old one has passed", async () => {
    const key = limitKey("login:ip", "10.0.0.1")
    for (let i = 0; i < 3; i++) await hit(key, RULE)
    await db.exec(`UPDATE "rate_limits" SET "windowStart" = "windowStart" - interval '16 minutes'`)
    expect(await retryAfter(key, RULE)).toBe(0)
    expect(await hit(key, RULE)).toBe(1)
  })

  it("hashes keys (no emails stored) and treats case and spaces alike", async () => {
    expect(limitKey("login:email", " A@B.com")).toBe(limitKey("login:email", "a@b.com"))
    await hit(limitKey("login:email", "a@b.com"), RULE)
    const { rows } = await db.query<{ key: string }>(`SELECT "key" FROM "rate_limits"`)
    expect(rows[0].key).not.toContain("a@b.com")
  })

  it("clears on success and prunes old windows", async () => {
    const key = limitKey("login:email", "x@y.z")
    await hit(key, RULE); await clearLimit(key)
    expect((await db.query(`SELECT 1 FROM "rate_limits"`)).rows).toHaveLength(0)
    await hit(key, RULE)
    await db.exec(`UPDATE "rate_limits" SET "windowStart" = "windowStart" - interval '2 days'`)
    expect(await pruneRateLimits()).toBe(1)
  })

  it("reads the client address from the proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "41.1.2.3, 10.0.0.1" }))).toBe("41.1.2.3")
    expect(clientIp({ "x-real-ip": "41.9.9.9" })).toBe("41.9.9.9")
    expect(clientIp({})).toBe("unknown")
  })
})
