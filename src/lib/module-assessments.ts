import { createHash, randomUUID } from "node:crypto"
import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"
import type { Prisma } from "@/prisma/client"
import type { ExamDraft } from "./exam-structure"
import type { LessonReplacement } from "./module-recreation-input"

export interface SavedExam {
  version: string; sourceName: string; durationMinutes: number; totalQuestions: number; totalMarks: number; instructions: string
  sections: { title: string; instructions: string; questions: { id: string; label: string; marks: number; optionIds: string[] }[] }[]
}
export interface AssessmentConfig { retiredQuestionIds?: string[]; topicPools: Record<string, string[]>; chapterPools: Record<string, string[]>; mock: SavedExam | null; mockReason: string; batchHash?: string }
export interface AssessmentDecision { exam: ExamDraft | null; reason: string }

export async function getModuleAssessments(moduleId: string): Promise<AssessmentConfig | null> {
  const rows = await orFallback(() => prisma.$queryRaw<{ assessmentConfig: string | null }[]>`SELECT "assessmentConfig" FROM "modules" WHERE "id" = ${moduleId}`, [])
  if (!rows[0]?.assessmentConfig) return null
  try { return JSON.parse(rows[0].assessmentConfig) as AssessmentConfig } catch { return null }
}

export async function saveAssessmentPools(tx: Prisma.TransactionClient, moduleId: string, lessons: LessonReplacement[], decision: AssessmentDecision) {
  const [row] = await tx.$queryRaw<{ assessmentConfig: string | null }[]>`SELECT "assessmentConfig" FROM "modules" WHERE "id" = ${moduleId} FOR UPDATE`
  if (!row) throw new Error("Module not found")
  const config: AssessmentConfig = row.assessmentConfig ? JSON.parse(row.assessmentConfig) : { topicPools: {}, chapterPools: {}, mock: null, mockReason: "" }
  const batchHash = createHash("sha256").update(JSON.stringify({ lessons, decision })).digest("hex")
  if (config.batchHash === batchHash) return
  const quizLessons = lessons.filter(l => l.questions?.length)
  const replacedTopics = quizLessons.map(l => l.topicId)
  const retiring = replacedTopics.length ? await tx.question.findMany({ where: { topicId: { in: replacedTopics } }, select: { id: true } }) : []
  config.retiredQuestionIds = [...new Set([...(config.retiredQuestionIds ?? []), ...retiring.map(q => q.id)])]
  for (const lesson of quizLessons) {
    if (!lesson.questions?.length) throw new Error("The regenerated quiz is missing")
    const questions = lesson.questions.map(q => ({ ...q, id: randomUUID() }))
    await tx.question.createMany({ data: questions.map(q => ({ id: q.id, topicId: lesson.topicId, question: q.question, difficulty: q.difficulty })) })
    if (questions.some(q => q.options.length)) await tx.answer.createMany({ data: questions.flatMap(q => q.options.map(answer => ({ id: randomUUID(), questionId: q.id, answer, isCorrect: answer === q.correctOption }))) })
    await tx.$executeRaw`
      UPDATE "questions" q SET "kind" = v.kind, "maxMarks" = v.marks, "writtenRubric" = v.rubric, "modelAnswer" = v.answer
      FROM unnest(${questions.map(q => q.id)}::text[], ${questions.map(q => q.kind ?? "mcq")}::text[], ${questions.map(q => q.marks ?? 1)}::int[], ${questions.map(q => q.rubric ? JSON.stringify(q.rubric) : null)}::text[], ${questions.map(q => q.modelAnswer ?? null)}::text[]) AS v(id, kind, marks, rubric, answer)
      WHERE q."id" = v.id`
    const ids = questions.map(q => q.id)
    config.topicPools[lesson.topicId] = ids
  }
  // Chapter questions are independently authored; topic recreation must neither
  // retire them nor copy topic IDs into their pool.
  config.chapterPools = {}
  config.mock = null
  config.mockReason = decision.reason
  if (decision.exam) {
    const exam = decision.exam
    const prepared = exam.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, id: randomUUID(), optionIds: q.options.map(() => randomUUID()) })) }))
    const all = prepared.flatMap(s => s.questions)
    // Dedicated exam questions never enter the topic/chapter quiz pools.
    await tx.question.createMany({ data: all.map(q => ({ id: q.id, question: q.question, difficulty: "medium" })) })
    await tx.answer.createMany({ data: all.flatMap(q => q.options.map((answer, i) => ({ id: q.optionIds[i], questionId: q.id, answer, isCorrect: answer === q.correctOption }))) })
    const sections: SavedExam["sections"] = prepared.map(s => ({ title: s.title, instructions: s.instructions, questions: s.questions.map(q => ({ id: q.id, label: q.label, marks: q.marks, optionIds: q.optionIds })) }))
    config.mock = { version: batchHash, sourceName: exam.sourceName, durationMinutes: exam.durationMinutes, totalQuestions: exam.totalQuestions, totalMarks: exam.totalMarks, instructions: exam.instructions, sections }
    config.mockReason = ""
  }
  config.batchHash = batchHash
  await tx.$executeRaw`UPDATE "modules" SET "assessmentConfig" = ${JSON.stringify(config)} WHERE "id" = ${moduleId}`
}

export function examQuestionMeta(exam: SavedExam) {
  return exam.sections.flatMap(s => s.questions.map(q => ({ id: q.id, label: q.label, marks: q.marks, optionIds: q.optionIds, section: s.title, instructions: s.instructions })))
}
