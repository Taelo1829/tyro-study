import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params
  const userId = await getAuthUserId()
  const mod = await prisma.module.findUnique({
    where: { id },
    include: {
      chapters: {
        orderBy: { order: "asc" },
        include: { _count: { select: { topics: true } } },
      },
      ...(userId && {
        enrollments: {
          where: { userId },
          select: { id: true, enrolledAt: true },
          take: 1,
        },
      }),
    },
  })

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 })
  }

  const enrollment =
    "enrollments" in mod ? mod.enrollments[0] : undefined
  const { enrollments: _, ...rest } = mod as typeof mod & {
    enrollments?: { id: string; enrolledAt: Date }[]
  }

  // Topics per chapter with no written lesson (no text, image or video) —
  // same rule as hasWrittenContent() in lib/topic-content.ts
  const emptyRows = await prisma.$queryRaw<{ chapterId: string; n: number }[]>`
    SELECT t."chapterId", COUNT(*)::int AS n
    FROM "topics" t
    JOIN "chapters" c ON c."id" = t."chapterId"
    WHERE c."moduleId" = ${id}
      AND (
        t."content" IS NULL
        OR (
          t."content" !~* '<(img|iframe|video)'
          AND regexp_replace(t."content", '<[^>]*>|&nbsp;|\s', '', 'gi') = ''
        )
      )
    GROUP BY t."chapterId"
  `
  const emptyByChapter = new Map(emptyRows.map(r => [r.chapterId, r.n]))

  return NextResponse.json({
    ...rest,
    chapters: rest.chapters.map(ch => ({ ...ch, topicsWithoutContent: emptyByChapter.get(ch.id) ?? 0 })),
    isEnrolled: Boolean(enrollment),
    enrolledAt: enrollment?.enrolledAt ?? null,
  })
}

export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = await request.json()
  const { title, description } = body as {
    title?: string
    description?: string
  }

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "The module needs a name" }, { status: 400 })
  }

  const updated = await prisma.module.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && {
        description: description?.trim() || null,
      }),
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  await prisma.module.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
