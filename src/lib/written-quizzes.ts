import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"
import type { WrittenFeedback, RubricItem } from "./written-quiz-types"
export interface QuestionFormat { id: string; kind: "mcq" | "blank" | "written"; maxMarks: number }
export async function questionFormats(ids: string[]): Promise<Map<string, QuestionFormat>> {
  if (!ids.length) return new Map()
  const rows = await orFallback(() => prisma.$queryRaw<QuestionFormat[]>`SELECT "id", "kind", "maxMarks" FROM "questions" WHERE "id" = ANY(${ids}::text[])`, [])
  return new Map(rows.map(row => [row.id, row]))
}
export async function writtenResults(attemptId: string): Promise<Map<string, WrittenFeedback>> {
  const rows = await orFallback(() => prisma.$queryRaw<{ questionId: string; writtenFeedback: string }[]>`SELECT "questionId", "writtenFeedback" FROM "question_attempts" WHERE "quizAttemptId" = ${attemptId} AND "status" = 'ANSWERED' AND "writtenFeedback" IS NOT NULL`, [])
  return new Map(rows.map(row => [row.questionId, JSON.parse(row.writtenFeedback) as WrittenFeedback]))
}
export async function writtenQuestion(id: string) {
  const [row] = await prisma.$queryRaw<{ id: string; question: string; maxMarks: number; writtenRubric: string | null; modelAnswer: string | null }[]>`SELECT "id", "question", "maxMarks", "writtenRubric", "modelAnswer" FROM "questions" WHERE "id" = ${id} AND "kind" = 'written'`
  if (!row?.writtenRubric || !row.modelAnswer) return null
  return { ...row, modelAnswer: row.modelAnswer, rubric: JSON.parse(row.writtenRubric) as RubricItem[] }
}

export function quizMarkTotal(questions: { id: string; maxMarks?: number }[], attempts: { questionId: string; status: string; isCorrect: boolean | null }[], written: Map<string, WrittenFeedback>) {
  let earnedMarks = 0, totalMarks = 0
  for (const q of questions) {
    const max = q.maxMarks ?? 1
    totalMarks += max
    const answer = attempts.find(a => a.questionId === q.id)
    if (answer?.status !== "ANSWERED") continue
    const marked = written.get(q.id)
    earnedMarks += marked ? Math.min(max, Math.max(0, marked.earnedMarks)) : answer.isCorrect ? max : 0
  }
  return { earnedMarks, totalMarks, score: totalMarks ? Math.round(earnedMarks / totalMarks * 100) : 0 }
}

/** Explicitly remove marking material before student question lists are serialized. */
export function publicQuestion<Q extends object>(question: Q, admin: boolean): Q {
  if (admin) return question
  const result = { ...question } as Q & { writtenRubric?: unknown; modelAnswer?: unknown; studyNote?: unknown }
  delete result.writtenRubric
  delete result.modelAnswer
  delete result.studyNote
  return result
}
