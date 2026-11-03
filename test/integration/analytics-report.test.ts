/**
 * Integration test: runs the real analytics SQL (src/lib/analytics-report.ts)
 * and the real event writer against an in-memory PostgreSQL (PGlite), with the
 * real migration. No network, no Neon.
 */
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, it } from "vitest"
import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"
import { getAnalyticsReport } from "@/lib/analytics-report"
import { writeEvent } from "@/lib/analytics"

const db = new PGlite()

async function run(strings: TemplateStringsArray, ...values: unknown[]) {
  const q = Prisma.sql(strings, ...values)
  return (await db.query(q.text, q.values as unknown[])).rows
}

/** Insert an event `hoursAgo` hours in the past */
function ev(name: string, user: string | null, hoursAgo: number, props: object | null = null, anon: string | null = null, path: string | null = null) {
  return db.query(
    `INSERT INTO "analytics_events" ("id","name","userId","anonId","path","props","createdAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5::jsonb, (NOW() AT TIME ZONE 'UTC') - make_interval(secs => $6::float8 * 3600))`,
    [name, user, anon, path, props ? JSON.stringify(props) : null, hoursAgo]
  )
}

beforeAll(async () => {
  await db.exec(`SET TIME ZONE 'UTC';
    CREATE TYPE "Role" AS ENUM ('STUDENT','ADMIN');
    CREATE TABLE "users" ("id" TEXT PRIMARY KEY, "role" "Role" NOT NULL DEFAULT 'STUDENT');`)
  await db.exec(readFileSync("prisma/migrations/20261029100000_analytics_events/migration.sql", "utf8"))
  // Route Prisma's raw queries to PGlite
  Object.assign(prisma, {
    $queryRaw: run,
    $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v), 1),
  })
  await db.exec(`INSERT INTO "users" VALUES ('s1','STUDENT'),('s2','STUDENT'),('s3','STUDENT'),('s4','STUDENT'),('a1','ADMIN')`)

  await ev("page_view", null, 300, { entry: true, referrer: "google.com" }, "v1", "/notes/clx1234567890abcdefghijkl")
  await ev("page_view", null, 299, null, "v1", "/register")
  await ev("page_view", null, 200, { entry: true }, "v2", "/")
  await ev("sign_up_started", null, 299, { level: "tertiary" }, "v1")
  // s1: signs up 10 days ago, passes a quiz within 24 h, returns the next day
  await ev("sign_up", "s1", 240, { level: "tertiary" }, "v1")
  await ev("module_joined", "s1", 239.5, { moduleId: "m1" })
  await ev("lesson_opened", "s1", 239.4, { topicId: "t1" })
  await ev("quiz_started", "s1", 239.3, { kind: "topic" })
  await ev("quiz_completed", "s1", 239, { kind: "topic", passed: true, score: 85 })
  await ev("page_view", "s1", 216, null, "v1", "/dashboard")
  await ev("lesson_opened", "s1", 30, { topicId: "t2" })
  // s2: signs up 9 days ago, fails a quiz, never returns
  await ev("sign_up", "s2", 216, { level: "highschool" })
  await ev("module_joined", "s2", 215, { moduleId: "m2" })
  await ev("quiz_started", "s2", 215, { kind: "chapter" })
  await ev("quiz_completed", "s2", 214, { kind: "chapter", passed: false, score: 40 })
  // s3: signed up 2 hours ago (too new for activation and return rates)
  await ev("sign_up", "s3", 2, { level: "tertiary" })
  // s4: older student, active this week
  await ev("quiz_completed", "s4", 5, { kind: "mock_exam", passed: true, score: 72 })
  // An admin's activity must never count
  await ev("sign_up", "a1", 100)
  await ev("quiz_completed", "a1", 3, { kind: "topic", passed: true, score: 100 })
})

describe("analytics report (30 days)", () => {
  it("works out activation, return rates and the funnel for new students", async () => {
    const { cohort } = await getAnalyticsReport(30)
    expect(cohort).toMatchObject({
      signUps: 3,
      activationEligible: 2,
      activated: 1,
      d1Eligible: 2,
      d1Returned: 1,
      d7Eligible: 2,
      d7Returned: 1,
      joinedModule: 2,
      openedLesson: 1,
      startedQuiz: 2,
      passedQuiz: 1,
    })
  })

  it("counts visitors and weekly active learners, ignoring admins", async () => {
    const { overview } = await getAnalyticsReport(30)
    expect(overview).toMatchObject({ visitors: 2, signUps: 3, signUpsStarted: 1, weeklyActiveLearners: 2 })
  })

  it("groups quizzes by kind and folds ids out of page paths", async () => {
    const r = await getAnalyticsReport(30)
    expect(r.quizzes.find(q => q.kind === "topic")).toMatchObject({ started: 1, completed: 1, passed: 1, avgScore: 85 })
    expect(r.pages.map(p => p.page)).toContain("/notes/:id")
    expect(r.sources.map(s => s.source).sort()).toEqual(["Direct or app", "google.com"])
    expect(r.weeks).toHaveLength(8)
  })

  it("narrows to the chosen range", async () => {
    const { cohort } = await getAnalyticsReport(7)
    expect(cohort.signUps).toBe(1) // only s3
  })
})

describe("event writer", () => {
  it("stores a clean event and drops query strings and nested props", async () => {
    await writeEvent("page_view", { anonId: "v9", path: "/notes?token=secret", props: { entry: true, utm_source: "whatsapp" } })
    const [row] = (await db.query(`SELECT "path", "props" FROM "analytics_events" WHERE "anonId" = 'v9'`)).rows as { path: string; props: unknown }[]
    expect(row.path).toBe("/notes")
    expect(row.props).toEqual({ entry: true, utm_source: "whatsapp" })
  })

  it("never throws, even when the insert fails (unknown user)", async () => {
    await expect(writeEvent("login", { userId: "does-not-exist" })).resolves.toBeUndefined()
  })
})
