import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { XLSX_ONLY } from "@/lib/excel/workbook"
import { parseFlashcardsExcel } from "@/lib/excel/flashcards"
import { BULK_BATCH_SIZE } from "@/lib/bulk-import"
import { captureError } from "@/lib/monitoring"

export const runtime = "nodejs"

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
    // .xlsx only: the parser (exceljs) doesn't read the old .xls format
    const validType = name.endsWith(".xlsx")

    if (!validType) {
      return NextResponse.json(
        { error: XLSX_ONLY },
        { status: 400 }
      )
    }

    const topic = await prisma.topic.findUnique({ where: { id: topicId } })
    if (!topic) {
      return NextResponse.json({ error: "Topic not found" }, { status: 404 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let parsed: Awaited<ReturnType<typeof parseFlashcardsExcel>>
    try {
      parsed = await parseFlashcardsExcel(buffer)
    } catch {
      return NextResponse.json({ error: XLSX_ONLY }, { status: 400 })
    }
    const { flashcards, errors } = parsed

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      )
    }

    let total = 0
    for (let i = 0; i < flashcards.length; i += BULK_BATCH_SIZE) {
      const batch = flashcards.slice(i, i + BULK_BATCH_SIZE)
      const result = await prisma.flashcard.createMany({
        data: batch.map((c) => ({
          topicId,
          front: c.front,
          back: c.back,
        })),
      })
      total += result.count
    }

    return NextResponse.json({
      count: total,
      message: `Imported ${total} flashcards`,
    })
  } catch (err) {
    captureError("Flashcards import error", err, "/api/flashcards/import")
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    )
  }
}
