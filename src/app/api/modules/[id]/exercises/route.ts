import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { orFallback } from "@/lib/db-safe"

/**
 * GET → { topics: [{ id, title, exercises }] } - every topic in the module that
 * has a lesson, in order, with how many "Try it yourself" exercises it has
 * (admin, for writing them for the whole module at once).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error
  const { id } = await params
  const topics = await prisma.topic.findMany({
    where: { chapter: { moduleId: id } },
    orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
    select: { id: true, title: true, content: true },
  })
  const withLesson = topics.filter(t => t.content?.replace(/<[^>]+>/g, "").trim())
  const counts = await orFallback(
    () => prisma.$queryRaw<{ topicId: string; n: number }[]>`
      SELECT "topicId", COUNT(*)::int AS "n" FROM "topic_exercises"
      WHERE "topicId" = ANY(${withLesson.map(t => t.id)}::text[]) GROUP BY "topicId"`,
    []
  )
  const byTopic = new Map(counts.map(c => [c.topicId, c.n]))
  return NextResponse.json({ topics: withLesson.map(t => ({ id: t.id, title: t.title, exercises: byTopic.get(t.id) ?? 0 })) })
}
