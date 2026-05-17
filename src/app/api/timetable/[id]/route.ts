import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, { params }: Params) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { chaptersCompleted } = body as { chaptersCompleted?: number }

  const existing = await prisma.timetable.findFirst({
    where: { id, userId: userId! },
  })

  if (!existing) {
    return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 })
  }

  const completed =
    chaptersCompleted === undefined
      ? existing.chaptersCompleted
      : Math.max(0, Math.floor(chaptersCompleted))

  const entry = await prisma.timetable.update({
    where: { id },
    data: {
      chaptersCompleted: Math.min(completed, existing.chaptersPlanned),
    },
    include: {
      module: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(entry)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const { id } = await params
  const existing = await prisma.timetable.findFirst({
    where: { id, userId: userId! },
    select: { id: true },
  })

  if (!existing) {
    return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 })
  }

  await prisma.timetable.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
