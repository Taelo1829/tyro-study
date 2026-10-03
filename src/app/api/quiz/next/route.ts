import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getTopicLock } from "@/lib/topic-locks"

/**
 * GET /api/quiz/next?topicId=… or ?chapterId=…
 *
 * The topic to study after passing a quiz, in course order (chapter order,
 * then topic order): the topic after this one (crossing into the next
 * chapter), or for a chapter quiz the first topic of the next chapter.
 * → { next: { id, title, chapterTitle, href, locked } | null, moduleHref }
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const topicId = req.nextUrl.searchParams.get("topicId")
  const chapterId = req.nextUrl.searchParams.get("chapterId")
  if (!topicId && !chapterId) return NextResponse.json({ error: "topicId or chapterId is required" }, { status: 400 })

  const moduleRow = topicId
    ? await prisma.topic.findUnique({ where: { id: topicId }, select: { chapter: { select: { moduleId: true } } } }).then(t => t?.chapter)
    : await prisma.chapter.findUnique({ where: { id: chapterId! }, select: { moduleId: true } })
  if (!moduleRow) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const moduleId = moduleRow.moduleId

  const chapters = await prisma.chapter.findMany({
    where: { moduleId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      topics: { orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true } },
    },
  })
  const ordered = chapters.flatMap(c => c.topics.map(t => ({ ...t, chapterId: c.id, chapterTitle: c.title })))

  let next: (typeof ordered)[number] | undefined
  if (topicId) {
    const at = ordered.findIndex(t => t.id === topicId)
    next = at >= 0 ? ordered[at + 1] : undefined
  } else {
    const ci = chapters.findIndex(c => c.id === chapterId)
    next = chapters.slice(ci + 1).flatMap(c => c.topics.map(t => ({ ...t, chapterId: c.id, chapterTitle: c.title })))[0]
  }

  const moduleHref = `/modules/${moduleId}`
  if (!next) return NextResponse.json({ next: null, moduleHref })

  // Still closed for this student? (e.g. it needs a different topic's quiz)
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
  const locked = user?.role === "ADMIN" ? false : !!(await getTopicLock(session.user.id, next.id))

  return NextResponse.json({
    next: {
      id: next.id,
      title: next.title,
      chapterTitle: next.chapterTitle,
      href: `${moduleHref}/topics/${next.id}`,
      locked,
    },
    moduleHref,
  })
}
