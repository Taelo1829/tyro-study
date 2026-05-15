import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const topic = await prisma.topic.findUnique({
    where: { id },
    include: {
      chapter: {
        include: { module: { select: { id: true, title: true } } },
      },
      questions: {
        include: { answers: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { flashcards: true } },
    },
  })

  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  }

  return NextResponse.json(topic)
}

export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, content, order } = body as {
    title?: string
    content?: string
    order?: number
  }

  const topic = await prisma.topic.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content?.trim() || null }),
      ...(order !== undefined && { order }),
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
