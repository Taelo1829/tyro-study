import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { writtenQuestion, writtenResults } from "@/lib/written-quizzes"
import { markWrittenSubmission, parseSubmissionPages, WrittenInputError } from "@/lib/written-grading"
import { MAX_WRITTEN_PAYLOAD } from "@/lib/written-quiz-types"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"
export const maxDuration = 180

export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error
  let claim: { attemptId: string; questionId: string } | null = null
  try {
    const raw = await request.text()
    if (Buffer.byteLength(raw) > MAX_WRITTEN_PAYLOAD) return NextResponse.json({ error: "Upload fewer or smaller pages." }, { status: 413 })
    const body = JSON.parse(raw)
    if (!body || typeof body.attemptId !== "string" || typeof body.questionId !== "string") throw new WrittenInputError("Choose a question in your quiz.")
    const attempt = await prisma.quizAttempt.findFirst({ where: { id: body.attemptId, userId: userId! }, select: { id: true, status: true, startedAt: true, settings: true } })
    if (!attempt) return NextResponse.json({ error: "Quiz not found" }, { status: 404 })
    const inQuiz = await prisma.questionAttempt.findUnique({ where: { quizAttemptId_questionId: { quizAttemptId: attempt.id, questionId: body.questionId } }, select: { status: true, updatedAt: true } })
    if (!inQuiz) return NextResponse.json({ error: "Question not in this quiz" }, { status: 404 })
    const existing = (await writtenResults(attempt.id)).get(body.questionId)
    if (existing) return NextResponse.json({ written: existing })
    const settings = JSON.parse(attempt.settings)
    const expired = settings.timeLimit && Date.now() > attempt.startedAt.getTime() + settings.timeLimit * 60_000
    if (attempt.status !== "IN_PROGRESS" || expired) return NextResponse.json({ error: "This quiz is no longer accepting answers." }, { status: 409 })
    const question = await writtenQuestion(body.questionId)
    if (!question || question.rubric.reduce((n, r) => n + r.marks, 0) !== question.maxMarks) return NextResponse.json({ error: "This question has no valid written marking rubric." }, { status: 400 })
    const pages = parseSubmissionPages(body.pages)
    const claimed = await prisma.questionAttempt.updateMany({
      where: { quizAttemptId: attempt.id, questionId: question.id, OR: [{ status: "PENDING" }, { status: "REVIEWING", updatedAt: { lt: new Date(Date.now() - 4 * 60_000) } }] },
      data: { status: "REVIEWING" },
    })
    if (!claimed.count) return NextResponse.json({ error: "This answer is already being marked. Please wait, then retry." }, { status: 409 })
    claim = { attemptId: attempt.id, questionId: question.id }
    const written = await markWrittenSubmission(question.question, question.rubric, question.modelAnswer, pages)
    const saved = await prisma.$executeRaw`
      UPDATE "question_attempts" qa SET "earnedMarks" = ${written.earnedMarks}, "writtenFeedback" = ${JSON.stringify(written)}, "isCorrect" = ${written.earnedMarks === written.maxMarks}, "status" = 'ANSWERED', "answeredAt" = NOW(), "updatedAt" = NOW()
      FROM "quiz_attempts" a WHERE qa."quizAttemptId" = a."id" AND a."id" = ${attempt.id} AND a."userId" = ${userId} AND a."status" = 'IN_PROGRESS' AND qa."questionId" = ${question.id} AND qa."status" = 'REVIEWING'`
    if (!saved) return NextResponse.json({ error: "The quiz ended before marking finished. This answer was not saved." }, { status: 409 })
    claim = null
    return NextResponse.json({ written })
  } catch (err) {
    if (err instanceof WrittenInputError || err instanceof SyntaxError) return NextResponse.json({ error: err instanceof WrittenInputError ? err.message : "Invalid submission." }, { status: 422 })
    captureError("Written answer marking failed", err, "/api/quiz/written")
    return NextResponse.json({ error: "Couldn't mark this answer. Please retry; no mark was saved." }, { status: 503 })
  } finally {
    if (claim) await prisma.questionAttempt.updateMany({ where: { quizAttemptId: claim.attemptId, questionId: claim.questionId, status: "REVIEWING" }, data: { status: "PENDING" } }).catch(() => {})
  }
}
