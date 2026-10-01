import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error
  const isAdmin = session?.user?.role === "ADMIN"

  const { id } = await params

  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      chapter: {
        include: {
          module: { select: { id: true, title: true } },
          topics: {
            select: { id: true, order: true },
            orderBy: { order: "asc" },
          },
        },
      },
      questions: {
        // Only admins get `isCorrect`; students are graded by /api/quiz/attempt
        include: {
          answers: { select: { id: true, answer: true, isCorrect: isAdmin } },
        },
        orderBy: { createdAt: "asc" },
      },
      pdfs: true,
      flashcards: {
        select: { id: true, front: true, back: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { flashcards: true } },
    },
  })

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  }

  const currentIndex = topic.chapter.topics.findIndex(
    (t) => t.id === topic.id
  )

  const nextTopic = topic.chapter.topics[currentIndex + 1]

  return NextResponse.json({
    ...topic,
    nextTopic: nextTopic?.id ?? null,
  })
}
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, content, order, assignment } = body as {
    title?: string
    content?: string
    order?: number
    assignment?: string
  }

  const topic = await prisma.topic.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content?.trim() || null }),
      ...(order !== undefined && { order }),
      ...(assignment !== undefined && { assignment }),
    },
  })

  return NextResponse.json(topic)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.topic.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
