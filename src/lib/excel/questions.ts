import { buildSheet, readFirstSheet } from "@/lib/excel/workbook"
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

export function buildQuestionsTemplate(): Promise<Buffer> {
  return buildSheet("Questions", QUESTION_HEADERS, SAMPLE_ROWS, [40, 18, 18, 18, 18, 18, 12])
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

export async function parseQuestionsExcel(buffer: Buffer): Promise<{
  questions: QuestionImportRow[]
  errors: string[]
}> {
  const { sheetFound, rows: raw } = await readFirstSheet(buffer)
  if (!sheetFound) {
    return { questions: [], errors: ["Workbook has no sheets"] }
  }

  const questions: QuestionImportRow[] = []
  const errors: string[] = []

  raw.forEach(({ row: rowNum, values }) => {
    const mapped: Record<string, string> = {}
    for (const [key, value] of Object.entries(values)) {
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
        `Row ${rowNum}: correct_option must match one of the option columns exactly -  but received ${correctOption}`
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
