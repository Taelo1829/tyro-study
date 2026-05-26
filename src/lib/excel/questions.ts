import * as XLSX from "xlsx"
import type { ExtractedQuestion } from "@/lib/ai/question-generator"

export interface QuestionImportRow extends ExtractedQuestion {
  difficulty: string
}

export const QUESTION_HEADERS = [
  "question",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "difficulty",
] as const

const SAMPLE_ROWS: string[][] = [
  [
    "What is the capital of France?",
    "London",
    "Paris",
    "Berlin",
    "Madrid",
    "Paris",
    "easy",
  ],
  [
    "Which planet is closest to the Sun?",
    "Venus",
    "Mercury",
    "Earth",
    "Mars",
    "Mercury",
    "medium",
  ],
]

export function buildQuestionsTemplate(): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([
    [...QUESTION_HEADERS],
    ...SAMPLE_ROWS,
  ])
  ws["!cols"] = [
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Questions")
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer
  )
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

export function parseQuestionsExcel(buffer: Buffer): {
  questions: QuestionImportRow[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { questions: [], errors: ["Workbook has no sheets"] }
  }

  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: "",
    raw: false,
  })

  const questions: QuestionImportRow[] = []
  const errors: string[] = []

  raw.forEach((row, index) => {
    const rowNum = index + 2
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(row)) {
      mapped[normalizeHeader(key)] = String(value ?? "").trim()
    }

    const question = mapped.question
    if (!question) {
      if (Object.values(mapped).some(Boolean)) {
        errors.push(`Row ${rowNum}: question is required`)
      }
      return
    }

    const options = [
      mapped.option_a,
      mapped.option_b,
      mapped.option_c,
      mapped.option_d,
    ].filter(Boolean)

    if (options.length < 2) {
      errors.push(`Row ${rowNum}: at least option_a and option_b are required`)
      return
    }

    const correctOption = mapped.correct_option
    if (!correctOption) {
      errors.push(`Row ${rowNum}: correct_option is required`)
      return
    }

    if (!options.includes(correctOption)) {
      errors.push(
        `Row ${rowNum}: correct_option must match one of the option columns exactly -  but recieved ${correctOption}`
      )
      return
    }

    const diff = mapped.difficulty?.toLowerCase()
    const difficulty =
      diff === "easy" || diff === "medium" || diff === "hard" ? diff : "medium"

    questions.push({ question, options, correctOption, difficulty })
  })

  if (questions.length === 0 && errors.length === 0) {
    errors.push("No valid question rows found")
  }

  return { questions, errors }
}
