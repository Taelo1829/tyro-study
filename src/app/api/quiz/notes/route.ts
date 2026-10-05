import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notesForQuestions } from "@/lib/ai/question-notes"

/**
 * POST { attemptId } → { notes: [{ questionId, question, topicId, html }] }
 *
 * Study notes for the questions this student got wrong in a finished quiz.
 * Notes are written by the AI only the first time a question is failed by
 * anyone, then reused (see lib/ai/question-notes.ts).
 */

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as { attemptId?: unknown }
  if (typeof body.attemptId !== "string") return NextResponse.json({ error: "attemptId is required" }, { status: 400 })

  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: body.attemptId, userId: session.user.id, status: "COMPLETED" },
    select: { questionAttempts: { orderBy: { order: "asc" }, select: { questionId: true, isCorrect: true, status: true } } },
  })
  if (!attempt) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })

  // Wrong or unanswered
  const missed = attempt.questionAttempts.filter(qa => qa.status !== "ANSWERED" || !qa.isCorrect).map(qa => qa.questionId)
  if (missed.length === 0) return NextResponse.json({ notes: [] })

  try {
    return NextResponse.json({ notes: await notesForQuestions(missed) })
  } catch (err) {
    console.error("Quiz notes error:", err)
    return NextResponse.json({ error: "Couldn't load notes for the questions you missed" }, { status: 500 })
  }
}
