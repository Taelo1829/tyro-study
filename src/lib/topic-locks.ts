import { prisma } from "@/lib/prisma"

/**
 * Locked topics.
 *
 * An admin can lock a topic. A locked topic only opens for a student once
 * they have passed the quiz of the topic before it - the previous topic in
 * course order (chapter order, then topic order; for a chapter's first topic
 * that's the last topic of the chapter before).
 *
 * - "Passed" = a completed topic quiz scoring at least PASS_MARK.
 * - If the previous topic has no questions yet there is nothing to pass, so
 *   the lock doesn't apply (students are never stuck).
 * - Admins are never locked out (callers skip these checks for them).
 *
 * The "locked" column is read and written with SQL so this works whether or
 * not the generated Prisma client has been regenerated since it was added.
 */

export const PASS_MARK = 70

export interface LockInfo {
  /** The topic the student must pass first */
  previousTopic: { id: string; title: string }
}

interface ModuleTopicRow {
  id: string
  title: string
  locked: boolean
  questionCount: number
}

/** Every topic of a module in course order, with its lock flag and question count */
async function moduleTopics(moduleId: string): Promise<ModuleTopicRow[]> {
  return prisma.$queryRaw<ModuleTopicRow[]>`
    SELECT t."id", t."title", t."locked",
           (SELECT COUNT(*)::int FROM "questions" q WHERE q."topicId" = t."id") AS "questionCount"
    FROM "topics" t
    JOIN "chapters" c ON c."id" = t."chapterId"
    WHERE c."moduleId" = ${moduleId}
    ORDER BY c."order" ASC, c."createdAt" ASC, t."order" ASC, t."createdAt" ASC
  `
}

/** Topic ids (among `topicIds`) whose quiz this user has passed */
async function passedTopics(userId: string, topicIds: string[]): Promise<Set<string>> {
  if (topicIds.length === 0) return new Set()
  const rows = await prisma.$queryRaw<{ topicId: string }[]>`
    SELECT DISTINCT "topicId"
    FROM "quiz_attempts"
    WHERE "userId" = ${userId}
      AND "topicId" = ANY(${topicIds})
      AND "status" = 'COMPLETED'
      AND "score" >= ${PASS_MARK}
  `
  return new Set(rows.map(r => r.topicId))
}

/**
 * For every topic in the module that is currently closed to this user,
 * which previous topic they must pass. Topics not in the map are open.
 */
export async function getModuleLocks(userId: string, moduleId: string): Promise<Map<string, LockInfo>> {
  const topics = await moduleTopics(moduleId)
  const gates = topics
    .map((topic, i) => ({ topic, previous: topics[i - 1] }))
    .filter(({ topic, previous }) => topic.locked && previous && previous.questionCount > 0)

  const passed = await passedTopics(userId, gates.map(g => g.previous!.id))
  const locks = new Map<string, LockInfo>()
  for (const { topic, previous } of gates) {
    if (!passed.has(previous!.id)) {
      locks.set(topic.id, { previousTopic: { id: previous!.id, title: previous!.title } })
    }
  }
  return locks
}

/** Lock info for one topic, or null when the user may open it */
export async function getTopicLock(userId: string, topicId: string): Promise<LockInfo | null> {
  const [row] = await prisma.$queryRaw<{ moduleId: string; locked: boolean }[]>`
    SELECT c."moduleId", t."locked"
    FROM "topics" t JOIN "chapters" c ON c."id" = t."chapterId"
    WHERE t."id" = ${topicId}
  `
  if (!row?.locked) return null
  const locks = await getModuleLocks(userId, row.moduleId)
  return locks.get(topicId) ?? null
}

/** Which of these topics an admin has marked as locked */
export async function getLockedFlags(topicIds: string[]): Promise<Set<string>> {
  if (topicIds.length === 0) return new Set()
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "topics" WHERE "id" = ANY(${topicIds}) AND "locked" = true
  `
  return new Set(rows.map(r => r.id))
}

export async function setTopicLocked(topicId: string, locked: boolean) {
  await prisma.$executeRaw`UPDATE "topics" SET "locked" = ${locked} WHERE "id" = ${topicId}`
}

/** Standard 403 body when a student opens a locked topic */
export function lockedResponseBody(lock: LockInfo) {
  return {
    error: `This topic is locked. Pass the “${lock.previousTopic.title}” quiz (${PASS_MARK}% or more) to open it.`,
    locked: true,
    previousTopic: lock.previousTopic,
    passMark: PASS_MARK,
  }
}
