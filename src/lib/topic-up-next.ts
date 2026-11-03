import { prisma } from "@/lib/prisma"
import { getModuleLocks } from "@/lib/topic-locks"

const TOPIC_COMPLETION_THRESHOLD = 0.7

export interface TopicUpNext {
  id: string
  title: string
  moduleId: string
  moduleTitle: string
  chapterTitle: string
  answered: number
  totalQuestions: number
}

export async function getTopicUpNext(userId: string, ofLevel: (moduleId: string) => boolean): Promise<TopicUpNext | null> {
  const all = await prisma.$queryRaw<TopicUpNext[]>`
    SELECT
      t."id",
      t."title",
      m."id" AS "moduleId",
      m."title" AS "moduleTitle",
      c."title" AS "chapterTitle",
      COUNT(DISTINCT q."id")::int AS "totalQuestions",
      COUNT(DISTINCT ua."questionId")::int AS "answered"
    FROM "module_enrollments" me
    INNER JOIN "modules" m ON m."id" = me."moduleId"
    INNER JOIN "chapters" c ON c."moduleId" = m."id"
    INNER JOIN "topics" t ON t."chapterId" = c."id"
    LEFT JOIN "questions" q ON q."topicId" = t."id"
    LEFT JOIN "user_answers" ua ON ua."questionId" = q."id" AND ua."userId" = ${userId}
    WHERE me."userId" = ${userId}
    GROUP BY me."enrolledAt", m."id", m."title", c."id", c."title", c."order", t."id", t."title", t."order"
    ORDER BY me."enrolledAt" ASC, c."order" ASC, t."order" ASC
  `
  const levelTopics = all.filter(t => ofLevel(t.moduleId))
  const moduleIds = [...new Set(levelTopics.map(topic => topic.moduleId))]
  const moduleLocks = new Map(await Promise.all(moduleIds.map(async moduleId =>
    [moduleId, await getModuleLocks(userId, moduleId)] as const
  )))
  // Apply access rules before ranking, including the last-resort fallback.
  const candidates = levelTopics.filter(topic => !moduleLocks.get(topic.moduleId)!.has(topic.id))

  return (
    candidates.find((topic) => {
      if (topic.totalQuestions === 0) return false
      const completeAt = Math.floor(topic.totalQuestions * TOPIC_COMPLETION_THRESHOLD)
      return topic.answered > 0 && topic.answered < completeAt
    }) ??
    candidates.find((topic) => topic.totalQuestions > 0 && topic.answered === 0) ??
    candidates[0] ??
    null
  )
}

