import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const { error, userId } = await requireAuth()
  if (error) return error

  const entries = await prisma.timetable.findMany({
    where: { userId: userId! },
    orderBy: { dueDate: "asc" },
    include: {
      module: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(entries)
}

export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const { assignmentTitle, moduleId, startDate, dueDate, chaptersPlanned } =
    body as {
      assignmentTitle?: string
      moduleId?: string
      startDate?: string
      dueDate?: string
      chaptersPlanned?: number
    }

  if (!assignmentTitle?.trim() || !startDate || !dueDate) {
    return NextResponse.json(
      { error: "Title, start date, and due date are required" },
      { status: 400 }
    )
  }

  const startsAt = new Date(startDate)
  const dueAt = new Date(dueDate)

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 })
  }

  if (dueAt < startsAt) {
    return NextResponse.json(
      { error: "Due date must be after the start date" },
      { status: 400 }
    )
  }

  let resolvedModuleId: string | null = null
  if (moduleId) {
    const enrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: { userId: userId!, moduleId },
      },
    })

    if (!enrollment) {
      return NextResponse.json(
        { error: "You are not enrolled in this module" },
        { status: 403 }
      )
    }

    resolvedModuleId = moduleId
  }

  const entry = await prisma.timetable.create({
    data: {
      userId: userId!,
      moduleId: resolvedModuleId,
      assignmentTitle: assignmentTitle.trim(),
      startDate: startsAt,
      dueDate: dueAt,
      chaptersPlanned: Math.max(0, Math.floor(chaptersPlanned ?? 0)),
    },
    include: {
      module: { select: { id: true, title: true } },
    },
  })

  return NextResponse.json(entry, { status: 201 })
}
