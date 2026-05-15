import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin"
import { prisma } from "@/lib/prisma"
import { parseFlashcardsExcel } from "@/lib/excel/flashcards"
import { BULK_BATCH_SIZE } from "@/lib/bulk-import"

export const runtime = "nodejs"

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

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
    const { flashcards, errors } = parseFlashcardsExcel(buffer)

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
    console.error("Flashcards import error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 500 }
    )
  }
}
