import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      module: { select: { id: true, title: true } },
      topics: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { questions: true } },
          questions: { include: { answers: true }, orderBy: { createdAt: "asc" } },
        },
      },
      questions: { include: { answers: true }, orderBy: { createdAt: "asc" } },
    },
  })

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
  }

  return NextResponse.json(chapter)
}

export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, order } = body as { title?: string; order?: number }

  const chapter = await prisma.chapter.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(order !== undefined && { order }),
    },
  })

  return NextResponse.json(chapter)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.chapter.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
