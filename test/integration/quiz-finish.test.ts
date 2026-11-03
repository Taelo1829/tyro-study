/**
 * Integration test for the batched quiz-finish writes (TS-053) against
 * PGlite: same results as the old per-question loop, in a fixed number of
 * statements however long the quiz is.
 */
import { PGlite } from "@electric-sql/pglite"
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { Prisma } from "@/prisma/client"
import { prisma } from "@/lib/prisma"
import { saveFinalAnswers } from "@/lib/quiz-finish"

const db = new PGlite()
let statements = 0
async function run(strings: TemplateStringsArray, ...values: unknown[]) {
  statements++
  const q = Prisma.sql(strings, ...values)
  return await db.query(q.text, q.values as unknown[])
}

beforeAll(async () => {
  await db.exec(`SET TIME ZONE 'UTC';
    CREATE TABLE "user_answers" (
      "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "questionId" TEXT NOT NULL,
      "selectedAnswerId" TEXT, "isCorrect" BOOLEAN NOT NULL, "typedAnswer" TEXT,
      "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);`)
  Object.assign(prisma, {
    $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).rows,
    $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) => (await run(s, ...v)).affectedRows ?? 0,
  })
})

beforeEach(async () => {
  await db.exec(`DELETE FROM "user_answers"`)
  statements = 0
})

const rows = async () => (await db.query<{ questionId: string; selectedAnswerId: string | null; isCorrect: boolean; typedAnswer: string | null; userId: string }>(
  `SELECT "userId", "questionId", "selectedAnswerId", "isCorrect", "typedAnswer" FROM "user_answers" ORDER BY "questionId"`)).rows

describe("saveFinalAnswers", () => {
  it("inserts new answers and updates earlier ones, one row per question", async () => {
    await db.exec(`INSERT INTO "user_answers" ("id","userId","questionId","selectedAnswerId","isCorrect") VALUES
      ('old1','u1','q1','a-wrong',false), ('other','u2','q1','x',true)`)
    const r = await saveFinalAnswers("u1", [
      { questionId: "q1", selectedAnswerId: "a-right", isCorrect: true },
      { questionId: "q2", selectedAnswerId: "b", isCorrect: false },
      { questionId: "q3", selectedAnswerId: null, isCorrect: true, typed: "printf" },
    ])
    expect(r).toEqual({ inserted: 2, updated: 1 })
    const mine = (await rows()).filter(x => x.userId === "u1")
    expect(mine).toEqual([
      { userId: "u1", questionId: "q1", selectedAnswerId: "a-right", isCorrect: true, typedAnswer: null },
      { userId: "u1", questionId: "q2", selectedAnswerId: "b", isCorrect: false, typedAnswer: null },
      { userId: "u1", questionId: "q3", selectedAnswerId: null, isCorrect: true, typedAnswer: "printf" },
    ])
    // another student's history is untouched
    expect((await rows()).find(x => x.userId === "u2")).toMatchObject({ selectedAnswerId: "x", isCorrect: true })
  })

  it("uses the same small number of statements for 10 or 80 questions", async () => {
    const quiz = (n: number) => Array.from({ length: n }, (_, i) => ({ questionId: `q${i}`, selectedAnswerId: `a${i}`, isCorrect: i % 2 === 0, typed: i % 10 === 0 ? `t${i}` : undefined }))
    await saveFinalAnswers("u1", quiz(10))
    const ten = statements
    statements = 0
    await saveFinalAnswers("u1", quiz(80)) // 10 updates + 70 inserts
    expect(statements).toBe(ten + 1) // + the UPDATE for the 10 already answered
    expect(statements).toBeLessThanOrEqual(4)
    expect((await rows()).length).toBe(80)
  })

  it("does nothing for an empty quiz", async () => {
    expect(await saveFinalAnswers("u1", [])).toEqual({ inserted: 0, updated: 0 })
    expect(statements).toBe(0)
  })
})
