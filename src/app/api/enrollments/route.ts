import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { track } from "@/lib/analytics"

export async function GET() {
  const { error, userId } = await requireAuth()
  if (error) return error

  const enrollments = await prisma.moduleEnrollment.findMany({
    where: { userId: userId! },
    orderBy: { enrolledAt: "desc" },
    include: {
      module: {
        include: { _count: { select: { chapters: true } } },
      },
    },
  })

  return NextResponse.json(
    enrollments.map((e) => ({
      enrolledAt: e.enrolledAt,
      ...e.module,
      isEnrolled: true,
    }))
  )
}

export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error

  const body = await request.json()
  const { moduleId } = body as { moduleId?: string }

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId is required" }, { status: 400 })
  }

  const mod = await prisma.module.findUnique({ where: { id: moduleId } })
  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 })
  }

  const alreadyJoined = await prisma.moduleEnrollment.findUnique({
    where: { userId_moduleId: { userId: userId!, moduleId } },
    select: { id: true },
  })

  const enrollment = await prisma.moduleEnrollment.upsert({
    where: {
      userId_moduleId: { userId: userId!, moduleId },
    },
    create: { userId: userId!, moduleId },
    update: {},
    include: {
      module: { include: { _count: { select: { chapters: true } } } },
    },
  })

  if (!alreadyJoined) track("module_joined", { userId, props: { moduleId } })

  return NextResponse.json(
    {
      enrolledAt: enrollment.enrolledAt,
      ...enrollment.module,
      isEnrolled: true,
    },
    { status: 201 }
  )
}
