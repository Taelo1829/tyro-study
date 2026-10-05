import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { toPlainText } from "@/lib/plain-text"
import { courseIdsByModule, setModuleCourses } from "@/lib/courses"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getUserLevel, moduleLevels, setModuleLevel } from "@/lib/levels-server"
import { isStudyLevel } from "@/lib/levels"

/**
 * Every module with its level, courses and whether the user joined it.
 * Students (and anyone asking with ?scope=mine) only get the modules or
 * subjects of their own level; admins get them all.
 */
export async function GET(request: Request) {
  const userId = await getAuthUserId()
  const session = userId ? await getServerSession(authOptions) : null
  const mine = new URL(request.url).searchParams.get("scope") === "mine" || session?.user?.role !== "ADMIN"

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

  const coursesOf = await courseIdsByModule()
  const levels = await moduleLevels()
  const userLevel = userId && mine ? await getUserLevel(userId) : null
  const levelOf = (id: string) => levels.get(id) ?? "tertiary"

  const result = modules.filter(m => !userLevel || levelOf(m.id) === userLevel).map((m) => {
    const enrollment = "enrollments" in m ? m.enrollments[0] : undefined
    const { enrollments: _, ...mod } = m as typeof m & {
      enrollments?: { id: string; enrolledAt: Date }[]
    }
    return {
      ...mod,
      isEnrolled: Boolean(enrollment),
      enrolledAt: enrollment?.enrolledAt ?? null,
      courseIds: coursesOf.get(m.id) ?? [],
      level: levelOf(m.id),
    }
  })

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { title, description, courseIds, level } = body as {
    title?: string
    description?: string
    courseIds?: unknown
    level?: unknown
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 })
  }

  const created = await prisma.module.create({
    data: {
      title: title.trim(),
      description: toPlainText(description) || null,
    },
  })

  if (isStudyLevel(level) && level !== "tertiary") {
    try {
      await setModuleLevel(created.id, level)
    } catch {
      await prisma.module.delete({ where: { id: created.id } })
      return NextResponse.json({ error: "High school subjects need the latest database update: run `npx prisma migrate deploy`." }, { status: 503 })
    }
  }

  if (Array.isArray(courseIds) && courseIds.length) {
    await setModuleCourses(created.id, courseIds.filter((c): c is string => typeof c === "string"))
  }

  return NextResponse.json(created, { status: 201 })
}
