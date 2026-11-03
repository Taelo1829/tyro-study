import { randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"

export interface FinalAnswer {
  questionId: string
  selectedAnswerId: string | null
  isCorrect: boolean
  /** What the student typed (fill-in-the-blank questions) */
  typed?: string
}

/**
 * Saves a finished quiz's answers to the student's permanent answer history
 * (user_answers) in a fixed number of statements, however long the quiz is:
 * one read, one insert, one update and one typed-answer update.
 *
 * Before (TS-053) this ran 2–3 statements per question: 335 statements to
 * finish an 80-question mock exam, each a network round trip to Neon
 * (business/08 §7.2). The behaviour is the same: one history row per
 * question, updated if the student answered it before.
 */
export async function saveFinalAnswers(userId: string, answers: FinalAnswer[]): Promise<{ inserted: number; updated: number }> {
  if (answers.length === 0) return { inserted: 0, updated: 0 }
  const questionIds = [...new Set(answers.map(a => a.questionId))]

  // 1. Existing history rows (newest per question if there are duplicates)
  const existing = await prisma.$queryRaw<{ id: string; questionId: string }[]>`
    SELECT DISTINCT ON ("questionId") "id", "questionId"
    FROM "user_answers"
    WHERE "userId" = ${userId} AND "questionId" = ANY(${questionIds}::text[])
    ORDER BY "questionId", "answeredAt" DESC`
  const idByQuestion = new Map(existing.map(r => [r.questionId, r.id]))

  const toUpdate = answers.filter(a => idByQuestion.has(a.questionId))
  const toInsert = answers.filter(a => !idByQuestion.has(a.questionId))

  // 2. New rows, in one INSERT
  if (toInsert.length) {
    await prisma.$executeRaw`
      INSERT INTO "user_answers" ("id", "userId", "questionId", "selectedAnswerId", "isCorrect", "answeredAt")
      SELECT v.id, ${userId}, v.q, v.sel, v.ok, (NOW() AT TIME ZONE 'UTC')
      FROM unnest(
        ${toInsert.map(() => randomUUID())}::text[],
        ${toInsert.map(a => a.questionId)}::text[],
        ${toInsert.map(a => a.selectedAnswerId)}::text[],
        ${toInsert.map(a => a.isCorrect)}::boolean[]
      ) AS v(id, q, sel, ok)`
  }

  // 3. Existing rows, in one UPDATE
  if (toUpdate.length) {
    await prisma.$executeRaw`
      UPDATE "user_answers" ua
      SET "selectedAnswerId" = v.sel, "isCorrect" = v.ok, "answeredAt" = (NOW() AT TIME ZONE 'UTC')
      FROM unnest(
        ${toUpdate.map(a => idByQuestion.get(a.questionId)!)}::text[],
        ${toUpdate.map(a => a.selectedAnswerId)}::text[],
        ${toUpdate.map(a => a.isCorrect)}::boolean[]
      ) AS v(id, sel, ok)
      WHERE ua."id" = v.id`
  }

  // 4. Typed answers (column added by a later migration, hence the fallback; ADR 0004)
  const typed = answers.filter(a => a.typed !== undefined)
  if (typed.length) {
    await orFallback(
      () => prisma.$executeRaw`
        UPDATE "user_answers" ua SET "typedAnswer" = v.t
        FROM unnest(${typed.map(a => a.questionId)}::text[], ${typed.map(a => a.typed!)}::text[]) AS v(q, t)
        WHERE ua."userId" = ${userId} AND ua."questionId" = v.q`,
      0
    )
  }
  return { inserted: toInsert.length, updated: toUpdate.length }
}
