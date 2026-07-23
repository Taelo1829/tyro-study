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

function createQuestionsBatch(
  parent: { topicId?: string; chapterId?: string },
  batch: QuestionImportRow[]
) {
  return prisma.$transaction(
    batch.map((q) =>
      prisma.question.create({
        data: {
          ...(parent.topicId ? { topicId: parent.topicId } : {}),
          ...(parent.chapterId ? { chapterId: parent.chapterId } : {}),
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
    const chapterId = formData.get("chapterId")

    const parent: { topicId?: string; chapterId?: string } = {}
    if (typeof topicId === "string" && topicId) parent.topicId = topicId
    if (typeof chapterId === "string" && chapterId) parent.chapterId = chapterId

    if (!parent.topicId && !parent.chapterId) {
      return NextResponse.json({ error: "topicId or chapterId is required" }, { status: 400 })
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

    if (parent.topicId) {
      const topic = await prisma.topic.findUnique({ where: { id: parent.topicId } })
      if (!topic) {
        return NextResponse.json({ error: "Topic not found" }, { status: 404 })
      }
    }
    if (parent.chapterId) {
      const chapter = await prisma.chapter.findUnique({ where: { id: parent.chapterId } })
      if (!chapter) {
        return NextResponse.json({ error: "Chapter not found" }, { status: 404 })
      }
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
      createQuestionsBatch(parent, batch)
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
