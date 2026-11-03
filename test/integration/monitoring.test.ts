/**
 * Integration test: error grouping, flood cap and heartbeats against an
 * in-memory PostgreSQL (PGlite) with the real observability migration.
 */
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"
import { errorSummary, heartbeat, listErrorGroups, listHeartbeats, recordError, resolveErrorGroup } from "@/lib/monitoring"

const db = new PGlite()
async function run(strings: TemplateStringsArray, ...values: unknown[]) {
  const q = Prisma.sql(strings, ...values)
  return await db.query(q.text, q.values as unknown[])
}

beforeAll(async () => {
  await db.exec("SET TIME ZONE 'UTC';")
  await db.exec(readFileSync("prisma/migrations/20261030090000_observability/migration.sql", "utf8"))
  Object.assign(prisma, {
    $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).rows,
    $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).affectedRows ?? 0,
  })
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

beforeEach(async () => {
  await db.exec(`DELETE FROM "error_events"; DELETE FROM "app_heartbeats";`)
})

describe("recordError", () => {
  it("groups repeats of the same error into one row with a count", async () => {
    const a = await recordError({ source: "server", name: "Error", message: "Quiz cm1abcdefghijklmnopqrstu has no questions", route: "/api/quiz/attempt", requestId: "r1" })
    const b = await recordError({ source: "server", name: "Error", message: "Quiz cm9zyxwvutsrqponmlkjihgf has no questions", route: "/api/quiz/attempt", requestId: "r2" })
    await recordError({ source: "client", name: "TypeError", message: "x is undefined", route: "/dashboard" })
    expect(a).toBe(b)
    const groups = await listErrorGroups()
    expect(groups).toHaveLength(2)
    const quiz = groups.find(g => g.fingerprint === a)!
    expect(quiz.count).toBe(2)
    expect(quiz.sampleRequestId).toBe("r2")
    expect(quiz.message).toContain("Quiz cm1abcdefghijklmnopqrstu") // stored message is the first occurrence
  })

  it("redacts personal data in stored messages", async () => {
    await recordError({ source: "server", message: "No account for nomsa@example.com" })
    const [g] = await listErrorGroups()
    expect(g.message).not.toContain("nomsa@example.com")
  })

  it("resolving hides a group until it happens again", async () => {
    const fp = (await recordError({ source: "server", message: "boom" }))!
    await resolveErrorGroup(fp)
    expect(await listErrorGroups()).toHaveLength(0)
    await recordError({ source: "server", message: "boom" })
    const [g] = await listErrorGroups()
    expect(g.resolvedAt).toBeNull()
    expect(g.count).toBe(2)
  })

  it("caps new groups per hour so a flood can't fill the table", async () => {
    for (let i = 0; i < 205; i++) await recordError({ source: "client", name: `E${i}`, message: "flood" })
    const [{ n }] = (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM "error_events"`)).rows
    expect(n).toBe(200)
    expect((await errorSummary()).newLastHour).toBe(200)
  })
})

describe("heartbeat", () => {
  it("records success and keeps the last success time after a failure", async () => {
    await heartbeat("cron:reminders", { ok: true, details: { sent: 3 } })
    const [first] = await listHeartbeats()
    expect(first.lastOkAt).not.toBeNull()
    await heartbeat("cron:reminders", { ok: false, error: new Error("Neon timeout for thabo@example.com") })
    const [after] = await listHeartbeats()
    expect(after.lastOkAt).toEqual(first.lastOkAt)
    expect(after.lastError).toContain("Neon timeout")
    expect(after.lastError).not.toContain("thabo@example.com")
  })
})
