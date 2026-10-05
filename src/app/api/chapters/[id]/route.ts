import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { getLockedFlags, getModuleLocks } from "@/lib/topic-locks"
import { blankQuestionIds } from "@/lib/question-kinds"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  const { error, session } = await requireAuth()
  if (error) return error
  // Only admins get `isCorrect`; students are graded by /api/quiz/attempt
  const isAdmin = session?.user?.role === "ADMIN"
  const answers = { select: { id: true, answer: true, isCorrect: isAdmin } }

  const { id } = await params
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      module: { select: { id: true, title: true } },
      topics: {
        orderBy: { order: "asc" },
        include: {
          _count: { select: { questions: true } },
          questions: { include: { answers }, orderBy: { createdAt: "asc" } },
        },
      },
      questions: { include: { answers }, orderBy: { createdAt: "asc" } },
    },
  })

  if (!chapter) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
  }

  // locked: an admin has locked the topic.
  // lockedBy: (students) the topic they must pass first - absent when it's open.
  const lockedFlags = await getLockedFlags(chapter.topics.map(t => t.id))
  const studentLocks = !isAdmin && session?.user?.id
    ? await getModuleLocks(session.user.id, chapter.module.id)
    : new Map()

  // Type-the-answer questions: their answers are the accepted answers, so only admins see them
  const blanks = isAdmin ? new Set<string>() : await blankQuestionIds([...chapter.questions, ...chapter.topics.flatMap(t => t.questions)].map(q => q.id))
  const hideBlankAnswers = <Q extends { id: string; answers: unknown[] }>(list: Q[]) => list.map(q => (blanks.has(q.id) ? { ...q, answers: [] } : q))

  return NextResponse.json({
    ...chapter,
    questions: hideBlankAnswers(chapter.questions),
    topics: chapter.topics.map(t => {
      const lockedBy = studentLocks.get(t.id)?.previousTopic ?? null
      return {
        ...t,
        questions: hideBlankAnswers(t.questions),
        // Don't hand out a still-locked topic's lesson or questions
        ...(lockedBy && { content: null, assignment: null, questions: [] }),
        locked: lockedFlags.has(t.id),
        lockedBy,
      }
    }),
  })
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
