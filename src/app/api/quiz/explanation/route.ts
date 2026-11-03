import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notesForQuestions } from "@/lib/ai/question-notes"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body.attemptId !== "string" || typeof body.questionId !== "string") {
    return NextResponse.json({ error: "attemptId and questionId are required" }, { status: 400 })
  }
  try {
    // Never reveal an explanation for an unmarked answer or someone else's quiz.
    const marked = await prisma.questionAttempt.findFirst({
      where: {
        quizAttemptId: body.attemptId,
        questionId: body.questionId,
        status: "ANSWERED",
        quizAttempt: { userId: session.user.id },
      },
      select: { questionId: true },
    })
    if (!marked) return NextResponse.json({ error: "Marked answer not found" }, { status: 404 })
    const [note] = await notesForQuestions([marked.questionId], { appendToLesson: false })
    if (!note) return NextResponse.json({ error: "The explanation is unavailable right now. Please try again." }, { status: 503 })
    return NextResponse.json({ html: note.html }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    captureError("Quiz explanation failed", error, "/api/quiz/explanation")
    return NextResponse.json({ error: "Couldn't load the explanation. Please try again." }, { status: 500 })
  }
}
