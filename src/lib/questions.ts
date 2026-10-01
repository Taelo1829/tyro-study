import { prisma } from "@/lib/prisma"

/**
 * The module a question currently belongs to (through its topic or chapter).
 * `undefined` = question doesn't exist; `null` = it isn't attached anywhere.
 */
export async function getQuestionModuleId(questionId: string): Promise<string | null | undefined> {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    select: {
      topic: { select: { chapter: { select: { moduleId: true } } } },
      chapter: { select: { moduleId: true } },
    },
  })
  if (!question) return undefined
  return question.topic?.chapter.moduleId ?? question.chapter?.moduleId ?? null
}
