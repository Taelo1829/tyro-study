import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { validateExtractedQuestions } from "@/lib/validators/question"
import type { ExtractedQuestion } from "@/lib/ai/question-generator"
import {
  BULK_BATCH_SIZE,
  BULK_TX_OPTIONS,
  runBatched,
} from "@/lib/bulk-import"

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const body = await request.json()
  const { topicId, questions, difficulty } = body as {
    topicId?: string
    questions?: ExtractedQuestion[]
    difficulty?: string
  }

  if (!topicId || !validateExtractedQuestions(questions)) {
    return NextResponse.json(
      { error: "topicId and valid questions array are required" },
      { status: 400 }
    )
  }

  const topic = await prisma.topic.findUnique({ where: { id: topicId } })
  if (!topic) {
    return NextResponse.json({ error: "Topic not found" }, { status: 404 })
  }

  const created = await runBatched(questions, BULK_BATCH_SIZE, (batch) =>
    prisma.$transaction(
      batch.map((q) =>
        prisma.question.create({
          data: {
            topicId,
            question: q.question,
            difficulty: difficulty ?? "medium",
            answers: {
              create: q.options.map((answer) => ({
                answer,
                isCorrect: answer === q.correctOption,
              })),
            },
          },
          include: { answers: true },
        })
      ),
      BULK_TX_OPTIONS
    )
  )

  return NextResponse.json({ count: created.length, questions: created }, { status: 201 })
}
