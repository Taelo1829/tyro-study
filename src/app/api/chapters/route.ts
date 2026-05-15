import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const moduleId = searchParams.get("moduleId")

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
  }

  const chapters = await prisma.chapter.findMany({
    where: { moduleId },
    orderBy: { order: "asc" },
    include: { _count: { select: { topics: true } } },
  })

  return NextResponse.json(chapters)
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { moduleId, title, order } = body as {
    moduleId?: string
    title?: string
    order?: number
  }

  if (!moduleId || !title?.trim()) {
    return NextResponse.json(
      { error: "moduleId and title are required" },
      { status: 400 }
    )
  }

  let chapterOrder = order
  if (chapterOrder === undefined) {
    const max = await prisma.chapter.aggregate({
      where: { moduleId },
      _max: { order: true },
    })
    chapterOrder = (max._max.order ?? -1) + 1
  }

  const chapter = await prisma.chapter.create({
    data: {
      moduleId,
      title: title.trim(),
      order: chapterOrder,
    },
  })

  return NextResponse.json(chapter, { status: 201 })
}
