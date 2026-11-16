export const ASSIGNMENT_QUIZ = "Assignment quiz: "
export const ASSIGNMENT_CHECKPOINT = "Assignment checkpoint: "
import type { GeneratedQuestion } from "@/lib/ai/writers"
export const MAX_PAPER_FILES = 20
export const MAX_PAPER_BYTES = 10 * 1024 * 1024
export const MAX_SOURCE_CHARS = 120_000
export const MAX_LESSON_CHARS = 100_000
export interface PaperSource { name: string; text: string; kind?: "assignment" | "exam"; format?: "auto" | "mcq" | "written" | "mixed" }
export interface RecreatedQuestion extends GeneratedQuestion {
  kind?: "mcq" | "written"; marks?: number; rubric?: { criterion: string; marks: number }[]; modelAnswer?: string
}
export interface LessonReplacement { topicId: string; version: string; html: string; questions?: RecreatedQuestion[]; quizUnchanged?: boolean }
export class RecreationInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "RecreationInputError"
    Object.setPrototypeOf(this, RecreationInputError.prototype)
  }
}

export function isRecreationInputError(error: unknown): error is RecreationInputError {
  return (
    error instanceof RecreationInputError ||
    (error instanceof Error && (error.name === "RecreationInputError" || error.constructor.name === "RecreationInputError"))
  )
}

export function parsePaperSources(value: unknown): PaperSource[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_PAPER_FILES) throw new RecreationInputError(`Choose 1–${MAX_PAPER_FILES} papers.`)
  let total = 0
  return value.map(source => {
    if (!source || typeof source.name !== "string" || !source.name.trim() || source.name.length > 255 || typeof source.text !== "string" || source.text.trim().length < 30) throw new RecreationInputError("Every paper needs a name and readable text.")
    total += source.text.length
    if (total > MAX_SOURCE_CHARS) throw new RecreationInputError("These papers contain too much text for one batch. Use fewer or shorter papers (120,000 characters per batch).")
    if (source.kind !== undefined && !["assignment", "exam"].includes(source.kind)) throw new RecreationInputError("Choose assignment or previous exam for each paper.")
    if (source.format !== undefined && !["auto", "mcq", "written", "mixed"].includes(source.format)) throw new RecreationInputError("Choose a valid assignment format.")
    return { name: source.name.trim(), text: source.text.trim(), ...(source.kind ? { kind: source.kind } : {}), ...(source.format ? { format: source.format } : {}) }
  })
}

export function parseReplacements(value: unknown): LessonReplacement[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new RecreationInputError("Choose between 1 and 200 lessons to save.")
  const seen = new Set<string>()
  return value.map(item => {
    if (!item || typeof item.topicId !== "string" || !item.topicId || typeof item.version !== "string" || !/^[a-f0-9]{64}$/.test(item.version) || typeof item.html !== "string" || !item.html.trim() || item.html.length > MAX_LESSON_CHARS) throw new RecreationInputError("A lesson draft is invalid. Generate it again.")
    if (seen.has(item.topicId)) throw new RecreationInputError("A topic was selected more than once.")
    seen.add(item.topicId)
    return { topicId: item.topicId, version: item.version, html: item.html, quizUnchanged: item.quizUnchanged === true, questions: item.questions === undefined ? undefined : parseQuizDraft(item.questions) }
  })
}

export function parseQuizDraft(value: unknown): RecreatedQuestion[] {
  if (!Array.isArray(value) || !value.length || value.length > 40) throw new RecreationInputError("Each topic needs 1–40 regenerated quiz questions.")
  return value.map(q => {
    if (!q || typeof q.question !== "string" || !q.question.trim() || q.question.length > 10000 || !["easy", "medium", "hard"].includes(q.difficulty)) throw new RecreationInputError("A regenerated quiz question is invalid.")
    const marks = q.marks ?? 1
    if (!Number.isInteger(marks) || marks < 1 || marks > 100) throw new RecreationInputError("Question marks must be between 1 and 100.")
    if (q.kind === "written") {
      if (typeof q.modelAnswer !== "string" || !q.modelAnswer.trim() || q.modelAnswer.length > 20000) throw new RecreationInputError("The written question needs a non-empty model answer of at most 20,000 characters.")
      if (!Array.isArray(q.rubric) || !q.rubric.length || q.rubric.length > 20 || q.rubric.some((r: { criterion?: unknown; marks?: unknown } | null) => !r || typeof r.criterion !== "string" || !r.criterion.trim() || r.criterion.length > 2000 || typeof r.marks !== "number" || !Number.isInteger(r.marks) || r.marks < 1)) throw new RecreationInputError("The written question needs 1–20 named rubric criteria, each with positive whole-number marks.")
      const rubricTotal = q.rubric.reduce((n: number, r: { marks: number }) => n + r.marks, 0)
      if (rubricTotal !== marks) throw new RecreationInputError(`The written question's rubric adds up to ${rubricTotal} marks, but the question is worth ${marks}. Keep the question total and correct the rubric allocations.`)
      return { question: q.question, difficulty: q.difficulty, kind: "written", marks, options: [], correctOption: "", rubric: q.rubric, modelAnswer: q.modelAnswer }
    }
    if ((q.kind !== undefined && q.kind !== "mcq") || !Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6 || q.options.some((a: unknown) => typeof a !== "string" || !a.trim() || a.length > 3000) || new Set(q.options).size !== q.options.length || !q.options.includes(q.correctOption)) throw new RecreationInputError("A regenerated choice question is invalid.")
    return { question: q.question, options: q.options, correctOption: q.correctOption, difficulty: q.difficulty, kind: "mcq", marks, explanation: typeof q.explanation === "string" ? q.explanation : undefined }
  })
}
