import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { XLSX_ONLY } from "@/lib/excel/workbook"
import { parseQuestionsExcel } from "@/lib/excel/questions"
import {
  BULK_BATCH_SIZE,
  BULK_TX_OPTIONS,
  runBatched,
} from "@/lib/bulk-import"
import type { QuestionImportRow } from "@/lib/excel/questions"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"

function createQuestionsBatch(
  parent: { topicId?: string; chapterId?: string },
  batch: QuestionImportRow[]
) {
  return prisma.$transaction(
    batch.map((q) =>
      prisma.question.create({
        data: {
          topicId: parent.topicId,
          chapterId: parent.chapterId,
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
    // .xlsx only: the parser (exceljs) doesn't read the old .xls format
    const validType = name.endsWith(".xlsx")

    if (!validType) {
      return NextResponse.json(
        { error: XLSX_ONLY },
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
    let parsed: Awaited<ReturnType<typeof parseQuestionsExcel>>
    try {
      parsed = await parseQuestionsExcel(buffer)
    } catch {
      return NextResponse.json({ error: XLSX_ONLY }, { status: 400 })
    }
    const { questions, errors } = parsed

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
    captureError("Questions import error", err, "/api/questions/import")
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    )
  }
}
