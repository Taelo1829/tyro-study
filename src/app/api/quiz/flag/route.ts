import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { hit, limitKey } from "@/lib/rate-limit"

const reasons = ["Incorrect answer", "Unclear question", "Missing information", "Wrong topic", "Other"]
export async function POST(request: Request) {
  const { error, userId } = await requireAuth()
  if (error) return error
  const body = await request.json().catch(() => null)
  if (!body || typeof body.attemptId !== "string" || typeof body.questionId !== "string" || !reasons.includes(body.reason) || (body.details !== undefined && (typeof body.details !== "string" || body.details.length > 1000))) {
    return NextResponse.json({ error: "Choose a reason and keep details under 1,000 characters." }, { status: 400 })
  }
  try {
    const entry = await prisma.questionAttempt.findFirst({
      where: { quizAttemptId: body.attemptId, questionId: body.questionId, quizAttempt: { userId: userId! } },
      include: { question: { include: { answers: true, topic: { include: { chapter: { include: { module: true } } } }, chapter: { include: { module: true } } } } },
    })
    if (!entry) return NextResponse.json({ error: "Question not found in your quiz." }, { status: 404 })
    if (await hit(limitKey("question-flag", userId!), { limit: 20, windowSeconds: 3600 }) > 20) {
      return NextResponse.json({ error: "You've sent several reports. Please try again later." }, { status: 429 })
    }
    const q = entry.question
    const chapter = q.topic?.chapter ?? q.chapter
    const message = [
      `Flagged question: ${body.reason}`, `Module: ${chapter?.module.title ?? "Unknown"}`,
      `Chapter: ${chapter?.title ?? "Unknown"}`, `Topic: ${q.topic?.title ?? "Chapter quiz"}`,
      `Question ID: ${q.id}`, `Question: ${q.question}`,
      ...q.answers.map(a => `Option${a.isCorrect ? " (marked correct)" : ""}: ${a.answer}`),
      `Student's report: ${body.details?.trim() || "No additional details"}`,
    ].join("\n")
    const page = q.topicId ? `/admin/topics/${q.topicId}` : q.chapterId ? `/admin/chapters/${q.chapterId}/quiz` : "/admin/feedback"
    await prisma.$executeRaw`
      INSERT INTO "feedback" ("id", "userId", "kind", "message", "page", "questionId")
      VALUES (${randomUUID()}, ${userId}, 'content', ${message}, ${page}, ${q.id})
      ON CONFLICT ("userId", "questionId") WHERE "questionId" IS NOT NULL AND "status" IN ('new', 'planned') DO NOTHING`
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("Question flag failed", error)
    return NextResponse.json({ error: "Couldn't flag this question. Please try again." }, { status: 503 })
  }
}
