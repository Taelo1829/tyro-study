import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"

/**
 * Published topics.
 *
 * An admin chooses which lessons are public study notes: readable at
 * /notes/<id> without signing in, listed on the home page and /notes, in the
 * sitemap, and shown with ads. Everything else stays inside the app for
 * signed-in students. New topics start unpublished.
 *
 * A published topic only appears publicly when it has a written lesson
 * (see lib/public-notes.ts). Locked topics are public too: the lock only
 * applies to signed-in students inside the app.
 *
 * The "published" column is read and written with SQL (like "locked") so this
 * works whether or not the Prisma client has been regenerated since it was added.
 */

/** Whether this topic is published (false if the migration hasn't run yet) */
export async function isTopicPublished(topicId: string): Promise<boolean> {
  return orFallback(async () => {
    const [row] = await prisma.$queryRaw<{ published: boolean }[]>`
      SELECT "published" FROM "topics" WHERE "id" = ${topicId}
    `
    return !!row?.published
  }, false)
}

export async function setTopicPublished(topicId: string, published: boolean) {
  await prisma.$executeRaw`UPDATE "topics" SET "published" = ${published} WHERE "id" = ${topicId}`
}

/** Publish or unpublish every topic in a module. Returns how many topics changed. */
export async function setModulePublished(moduleId: string, published: boolean): Promise<number> {
  return prisma.$executeRaw`
    UPDATE "topics" t SET "published" = ${published}
    FROM "chapters" c
    WHERE c."id" = t."chapterId" AND c."moduleId" = ${moduleId} AND t."published" <> ${published}
  `
}

export interface ModulePublishCounts {
  /** Topics in the module */
  total: number
  /** Topics marked published */
  published: number
  /** Published topics that actually show publicly (have a written lesson) */
  live: number
}

export async function getModulePublishCounts(moduleId: string): Promise<ModulePublishCounts> {
  return orFallback(async () => {
    const [row] = await prisma.$queryRaw<ModulePublishCounts[]>`
      SELECT COUNT(*)::int AS "total",
             COUNT(*) FILTER (WHERE t."published")::int AS "published",
             COUNT(*) FILTER (
               WHERE t."published" AND t."content" IS NOT NULL
                 AND (t."content" ~* '<(img|iframe|video)'
                      OR regexp_replace(t."content", '<[^>]*>|&nbsp;|\\s', '', 'gi') <> '')
             )::int AS "live"
      FROM "topics" t JOIN "chapters" c ON c."id" = t."chapterId"
      WHERE c."moduleId" = ${moduleId}
    `
    return row ?? { total: 0, published: 0, live: 0 }
  }, { total: 0, published: 0, live: 0 })
}
