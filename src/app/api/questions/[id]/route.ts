import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { getQuestionModuleId } from "@/lib/questions"

type Params = { params: Promise<{ id: string }> }

// DELETE /api/questions/:id - admin only.
// The question's answers and any student answers/quiz attempts for it are
// removed with it (onDelete: Cascade in the schema).
export async function DELETE(_request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params

  const existing = await prisma.question.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 })
  }

  await prisma.question.delete({ where: { id } })
  return NextResponse.json({ success: true })
}

// PATCH /api/questions/:id - admin only. Moves a question within its module.
// Body: { topicId } to put it in a topic, or { chapterId } to make it a
// chapter-level question (shown in that chapter's quiz only).
// A question belongs to exactly one place, so the other field is cleared.
// Moving to a topic/chapter in a different module is refused.
export async function PATCH(request: Request, { params }: Params) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const body = (await request.json().catch(() => ({}))) as {
    topicId?: string
    chapterId?: string
  }
  const topicId = typeof body.topicId === "string" && body.topicId ? body.topicId : null
  const chapterId = typeof body.chapterId === "string" && body.chapterId ? body.chapterId : null

  if ((topicId ? 1 : 0) + (chapterId ? 1 : 0) !== 1) {
    return NextResponse.json(
      { error: "Provide exactly one of topicId or chapterId" },
      { status: 400 }
    )
  }

  const currentModuleId = await getQuestionModuleId(id)
  if (currentModuleId === undefined) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 })
  }

  let targetModuleId: string | null = null
  if (topicId) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { chapter: { select: { moduleId: true } } },
    })
    if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    targetModuleId = topic.chapter.moduleId
  } else if (chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { moduleId: true },
    })
    if (!chapter) return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
    targetModuleId = chapter.moduleId
  }

  if (currentModuleId && targetModuleId !== currentModuleId) {
    return NextResponse.json(
      { error: "Questions can only be moved within their own module" },
      { status: 400 }
    )
  }

  const question = await prisma.question.update({
    where: { id },
    data: { topicId, chapterId },
    select: { id: true, topicId: true, chapterId: true },
  })

  return NextResponse.json(question)
}

