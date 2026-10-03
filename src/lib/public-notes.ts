import { prisma } from "@/lib/prisma"

/**
 * Public study notes: the written lessons anyone (including search engines
 * and AdSense review) can read without signing in.
 *
 * A topic is public when it has a written lesson (text, image or video — the
 * same rule as hasWrittenContent in lib/topic-content.ts) and is NOT locked
 * (locked topics stay in-app so students can't read ahead of the lock).
 * Quizzes, flashcards, PDFs, assignments and progress stay behind login.
 */

export interface PublicTopicRow {
  id: string
  title: string
  chapterId: string
  chapterTitle: string
  moduleId: string
  moduleTitle: string
  moduleDescription: string | null
  updatedAt: Date | null
}

/** Every public topic, in course order (module title, chapter order, topic order) */
export async function listPublicTopics(): Promise<PublicTopicRow[]> {
  return prisma.$queryRaw<PublicTopicRow[]>`
    SELECT t."id", t."title",
           c."id" AS "chapterId", c."title" AS "chapterTitle",
           m."id" AS "moduleId", m."title" AS "moduleTitle", m."description" AS "moduleDescription",
           t."createdAt" AS "updatedAt"
    FROM "topics" t
    JOIN "chapters" c ON c."id" = t."chapterId"
    JOIN "modules" m ON m."id" = c."moduleId"
    WHERE t."locked" = false
      AND t."content" IS NOT NULL
      AND (
        t."content" ~* '<(img|iframe|video)'
        OR regexp_replace(t."content", '<[^>]*>|&nbsp;|\\s', '', 'gi') <> ''
      )
    ORDER BY m."title" ASC, c."order" ASC, c."createdAt" ASC, t."order" ASC, t."createdAt" ASC
  `
}

export interface PublicModule {
  id: string
  title: string
  description: string | null
  chapters: { id: string; title: string; topics: { id: string; title: string }[] }[]
  topicCount: number
}

/** Public topics grouped by module and chapter */
export async function listPublicModules(): Promise<PublicModule[]> {
  const rows = await listPublicTopics()
  const modules = new Map<string, PublicModule>()
  for (const row of rows) {
    let mod = modules.get(row.moduleId)
    if (!mod) {
      mod = { id: row.moduleId, title: row.moduleTitle, description: row.moduleDescription, chapters: [], topicCount: 0 }
      modules.set(row.moduleId, mod)
    }
    let chapter = mod.chapters.find(c => c.id === row.chapterId)
    if (!chapter) {
      chapter = { id: row.chapterId, title: row.chapterTitle, topics: [] }
      mod.chapters.push(chapter)
    }
    chapter.topics.push({ id: row.id, title: row.title })
    mod.topicCount++
  }
  return [...modules.values()]
}

export interface PublicTopic extends PublicTopicRow {
  content: string
  previous: { id: string; title: string } | null
  next: { id: string; title: string } | null
}

/** One public lesson with its neighbours in the same module, or null if it isn't public */
export async function getPublicTopic(id: string): Promise<PublicTopic | null> {
  const all = await listPublicTopics()
  const index = all.findIndex(t => t.id === id)
  if (index === -1) return null
  const row = all[index]

  const topic = await prisma.topic.findUnique({ where: { id }, select: { content: true } })
  if (!topic?.content) return null

  const sameModule = (t: PublicTopicRow | undefined) => (t && t.moduleId === row.moduleId ? { id: t.id, title: t.title } : null)
  return {
    ...row,
    content: topic.content,
    previous: sameModule(all[index - 1]),
    next: sameModule(all[index + 1]),
  }
}
