import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
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

  return NextResponse.json(topics)
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
      content: content?.trim() || null,
      order: topicOrder,
    },
  })

  return NextResponse.json(topic, { status: 201 })
}
