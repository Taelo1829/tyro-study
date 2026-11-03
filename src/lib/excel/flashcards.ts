import { buildSheet, readFirstSheet } from "@/lib/excel/workbook"

export const FLASHCARD_HEADERS = ["front", "back"] as const

export interface FlashcardRow {
  front: string
  back: string
}

const SAMPLE_ROWS: string[][] = [
  ["What is photosynthesis?", "The process plants use to convert light into energy"],
  ["Define osmosis", "Movement of water across a semipermeable membrane"],
]

export function buildFlashcardsTemplate(): Promise<Buffer> {
  return buildSheet("Flashcards", FLASHCARD_HEADERS, SAMPLE_ROWS, [40, 50])
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

export async function parseFlashcardsExcel(buffer: Buffer): Promise<{
  flashcards: FlashcardRow[]
  errors: string[]
}> {
  const { sheetFound, rows: raw } = await readFirstSheet(buffer)
  if (!sheetFound) {
    return { flashcards: [], errors: ["Workbook has no sheets"] }
  }

  const flashcards: FlashcardRow[] = []
  const errors: string[] = []

  raw.forEach(({ row: rowNum, values }) => {
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
      mapped[normalizeHeader(key)] = String(value ?? "").trim()
    }

    const front = mapped.front
    const back = mapped.back

    if (!front && !back) return

    if (!front || !back) {
      errors.push(`Row ${rowNum}: both front and back are required`)
      return
    }

    flashcards.push({ front, back })
  })

  if (flashcards.length === 0 && errors.length === 0) {
    errors.push("No valid flashcard rows found")
  }

  return { flashcards, errors }
}
