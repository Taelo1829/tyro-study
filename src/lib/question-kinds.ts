import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"

/**
 * Type-the-answer quiz questions ("blank" questions): the student types into
 * the blank (____) in the question's code instead of picking an option. Every
 * answer row of a blank question is an accepted answer.
 *
 * The `kind` and `typedAnswer` columns are read and written with SQL; before
 * their migration has run every question is multiple choice.
 */

/** The blank questions among these ids */
export async function blankQuestionIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await orFallback(
    () => prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "questions" WHERE "kind" = 'blank' AND "id" = ANY(${ids}::text[])`,
    []
  )
  return new Set(rows.map(r => r.id))
}

export async function markBlankQuestion(id: string) {
  await prisma.$executeRaw`UPDATE "questions" SET "kind" = 'blank' WHERE "id" = ${id}`
}

/** What the student typed, per question, in one quiz attempt */
export async function typedAnswers(quizAttemptId: string): Promise<Map<string, string>> {
  const rows = await orFallback(
    () => prisma.$queryRaw<{ questionId: string; typedAnswer: string }[]>`
      SELECT "questionId", "typedAnswer" FROM "question_attempts"
      WHERE "quizAttemptId" = ${quizAttemptId} AND "typedAnswer" IS NOT NULL`,
    []
  )
  return new Map(rows.map(r => [r.questionId, r.typedAnswer]))
}

export async function saveTypedAnswer(quizAttemptId: string, questionId: string, typed: string) {
  await prisma.$executeRaw`
    UPDATE "question_attempts" SET "typedAnswer" = ${typed}
    WHERE "quizAttemptId" = ${quizAttemptId} AND "questionId" = ${questionId}`
}

export async function saveUserTypedAnswer(userAnswerId: string, typed: string) {
  await orFallback(() => prisma.$executeRaw`UPDATE "user_answers" SET "typedAnswer" = ${typed} WHERE "id" = ${userAnswerId}`, 0)
}
