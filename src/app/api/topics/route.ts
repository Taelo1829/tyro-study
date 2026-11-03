import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { hasWrittenContent } from "@/lib/topic-content"

/**
 * Topics of a chapter. Signed-in users only. Lesson text and assignment briefs
 * are returned to admins only: students read a lesson through /api/topics/[id],
 * which enforces topic locks (this list used to return every lesson, locked and
 * unpublished ones included, to anyone).
 */
export async function GET(request: Request) {
  const { error, session } = await requireAuth()
  if (error) return error
  const isAdmin = session?.user?.role === "ADMIN"

  const { searchParams } = new URL(request.url)
  const chapterId = searchParams.get("chapterId")

  if (!chapterId) {
    return NextResponse.json(
      { error: "chapterId is required" },
      { status: 400 }
    )
  }

  const topics = await prisma.topic.findMany({
    where: { chapterId },
    orderBy: { order: "asc" },
    include: { _count: { select: { questions: true, flashcards: true } } },
  })

  if (isAdmin) return NextResponse.json(topics)
  return NextResponse.json(
    topics.map(t => {
      const { content, assignment, ...rest } = t
      void content
      void assignment
      return rest
    })
  )
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { chapterId, title, content, order } = body as {
    chapterId?: string
    title?: string
    content?: string
    order?: number
  }

  if (!chapterId || !title?.trim()) {
    return NextResponse.json(
      { error: "chapterId and title are required" },
      { status: 400 }
    )
  }

  let topicOrder = order
  if (topicOrder === undefined) {
    const max = await prisma.topic.aggregate({
      where: { chapterId },
      _max: { order: true },
    })
    topicOrder = (max._max.order ?? -1) + 1
  }

  const topic = await prisma.topic.create({
    data: {
      chapterId,
      title: title.trim(),
      content: hasWrittenContent(content) ? content!.trim() : null,
      order: topicOrder,
    },
  })

  return NextResponse.json(topic, { status: 201 })
}
