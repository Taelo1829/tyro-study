import * as XLSX from "xlsx"

export const FLASHCARD_HEADERS = ["front", "back"] as const

export interface FlashcardRow {
  front: string
  back: string
}

const SAMPLE_ROWS: string[][] = [
  ["What is photosynthesis?", "The process plants use to convert light into energy"],
  ["Define osmosis", "Movement of water across a semipermeable membrane"],
]

export function buildFlashcardsTemplate(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    [...FLASHCARD_HEADERS],
    ...SAMPLE_ROWS,
  ])
  ws["!cols"] = [{ wch: 40 }, { wch: 50 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Flashcards")
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  )
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

export function parseFlashcardsExcel(buffer: Buffer): {
  flashcards: FlashcardRow[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { flashcards: [], errors: ["Workbook has no sheets"] }
  }

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  })

  const flashcards: FlashcardRow[] = []
  const errors: string[] = []

  raw.forEach((row, index) => {
    const rowNum = index + 2
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
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
