import { prisma } from "@/lib/prisma"
import type { AssessmentConfig } from "./module-assessments"

export const isUploadedAssignmentId = (id: string) => /^assignment-[a-f0-9]{40}$/.test(id)

/** Delete only a topic owned by the assignment uploader, never a matched chapter. */
export async function deleteUploadedAssignment(moduleId: string, topicId: string) {
  if (!isUploadedAssignmentId(topicId)) return false
  return prisma.$transaction(async tx => {
    // Same lock used by uploads: saving and deleting this module cannot race.
    const [module] = await tx.$queryRaw<{ id: string; assessmentConfig: string | null }[]>`SELECT "id", "assessmentConfig" FROM "modules" WHERE "id" = ${moduleId} FOR UPDATE`
    if (!module) return false
    const topic = await tx.topic.findFirst({ where: { id: topicId, chapter: { moduleId } }, select: { id: true, questions: { select: { id: true } } } })
    if (!topic) return false
    const questionIds = new Set(topic.questions.map(q => q.id))
    if (module.assessmentConfig) {
      const config = JSON.parse(module.assessmentConfig) as AssessmentConfig
      delete config.topicPools[topicId]
      for (const chapterId of Object.keys(config.chapterPools)) config.chapterPools[chapterId] = config.chapterPools[chapterId].filter(id => !questionIds.has(id))
      config.retiredQuestionIds = config.retiredQuestionIds?.filter(id => !questionIds.has(id))
      delete config.batchHash
      await tx.$executeRaw`UPDATE "modules" SET "assessmentConfig" = ${JSON.stringify(config)} WHERE "id" = ${moduleId}`
    }
    // Topic FK uses SET NULL for quizzes, so remove its attempts explicitly first.
    await tx.quizAttempt.deleteMany({ where: { topicId } })
    // Legacy assignment attempts have no topic foreign key.
    await tx.assignment_Attempt.deleteMany({ where: { topicId } })
    // Cascades questions, options, user answers, question attempts/feedback, flashcards,
    // topic PDF records, coding projects/submissions and exercises for this topic.
    await tx.topic.delete({ where: { id: topicId } })
    return true
  }, { maxWait: 20000, timeout: 120000 })
}
