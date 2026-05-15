import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { parseQuestionsExcel } from "@/lib/excel/questions"
import {
  BULK_BATCH_SIZE,
  BULK_TX_OPTIONS,
  runBatched,
} from "@/lib/bulk-import"
import type { QuestionImportRow } from "@/lib/excel/questions"

export const runtime = "nodejs"

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

function createQuestionsBatch(topicId: string, batch: QuestionImportRow[]) {
  return prisma.$transaction(
    batch.map((q) =>
      prisma.question.create({
        data: {
          topicId,
          question: q.question,
          difficulty: q.difficulty,
          answers: {
            create: q.options.map((answer) => ({
              answer,
              isCorrect: answer === q.correctOption,
            })),
          },
        },
      })
    ),
    BULK_TX_OPTIONS
  )
}

export async function POST(request: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  try {
    const formData = await request.formData()
    const file = formData.get("file")
    const topicId = formData.get("topicId")

    if (!topicId || typeof topicId !== "string") {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 })
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Excel file is required" }, { status: 400 })
    }

    const name = file.name.toLowerCase()
    const validType =
      ACCEPTED_TYPES.includes(file.type) ||
      name.endsWith(".xlsx") ||
      name.endsWith(".xls")

    if (!validType) {
      return NextResponse.json(
        { error: "Upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      )
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { questions, errors } = parseQuestionsExcel(buffer)

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      )
    }

    const created = await runBatched(questions, BULK_BATCH_SIZE, (batch) =>
      createQuestionsBatch(topicId, batch)
    )

    return NextResponse.json({
      count: created.length,
      message: `Imported ${created.length} questions`,
    })
  } catch (err) {
    console.error("Questions import error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    )
  }
}
