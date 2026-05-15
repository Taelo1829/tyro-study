import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const userId = await getAuthUserId()

  const modules = await prisma.module.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { chapters: true, enrollments: true } },
      ...(userId && {
        enrollments: {
          where: { userId },
          select: { id: true, enrolledAt: true },
          take: 1,
        },
      }),
    },
  })

  const result = modules.map((m) => {
    const enrollment = "enrollments" in m ? m.enrollments[0] : undefined
    const { enrollments: _, ...mod } = m as typeof m & {
      enrollments?: { id: string; enrolledAt: Date }[]
    }
    return {
      ...mod,
      isEnrolled: Boolean(enrollment),
      enrolledAt: enrollment?.enrolledAt ?? null,
    }
  })

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { title, description } = body as {
    title?: string
    description?: string
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const created = await prisma.module.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
    },
  })

  return NextResponse.json(created, { status: 201 })
}
