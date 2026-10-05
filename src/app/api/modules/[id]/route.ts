import { NextResponse } from "next/server"
import { del } from "@vercel/blob"
import { requireAdmin } from "@/lib/admin"
import { getAuthUserId } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { SUPERUSER_ONLY, isSuperuser } from "@/lib/superuser"
import { toPlainText } from "@/lib/plain-text"
import { setModuleCourses } from "@/lib/courses"

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

  // Topics per chapter with no written lesson (no text, image or video) -
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

  const courseRows = await prisma.$queryRaw<{ id: string; title: string }[]>`
    SELECT c."id", c."title" FROM "course_modules" cm JOIN "courses" c ON c."id" = cm."courseId"
    WHERE cm."moduleId" = ${id} ORDER BY lower(c."title")`

  return NextResponse.json({
    ...rest,
    courses: courseRows,
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
  const { title, description, courseIds } = body as {
    title?: string
    description?: string
    /** When given, the module is put in exactly these courses */
    courseIds?: unknown
  }

  if (title !== undefined && !title.trim()) {
    return NextResponse.json({ error: "The module needs a name" }, { status: 400 })
  }

  const updated = await prisma.module.update({
    where: { id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(description !== undefined && {
        description: toPlainText(description) || null,
      }),
    },
  })

  if (Array.isArray(courseIds)) {
    await setModuleCourses(id, courseIds.filter((c): c is string => typeof c === "string"))
  }

  return NextResponse.json(updated)
}

// DELETE /api/modules/:id - superusers only. Deletes the module with its chapters,
// topics, lessons, questions, flashcards, PDFs and students' enrolments and
// quiz answers for it. Uploaded PDF files are removed from storage too.
export async function DELETE(_request: Request, { params }: Params) {
  const { error, user } = await requireAdmin()
  if (error) return error
  if (!(await isSuperuser(user!.id))) return NextResponse.json({ error: SUPERUSER_ONLY }, { status: 403 })

  const { id } = await params
  const mod = await prisma.module.findUnique({ where: { id }, select: { id: true } })
  if (!mod) return NextResponse.json({ error: "Module not found" }, { status: 404 })

  const pdfs = await prisma.topicPdf.findMany({
    where: { topic: { chapter: { moduleId: id } } },
    select: { url: true },
  })

  await prisma.module.delete({ where: { id } })

  // Best effort: a file that can't be removed doesn't undo the delete
  const blobUrls = pdfs.map(p => p.url).filter(u => /\.blob\.vercel-storage\.com\//.test(u))
  if (blobUrls.length) {
    await del(blobUrls).catch(err => console.warn("Module delete: could not remove PDFs", err))
  }

  return NextResponse.json({ success: true })
}
