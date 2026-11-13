import { RecreationInputError, type PaperSource } from "./module-recreation-input"

export interface ExamQuestion {
  label: string; question: string; options: string[]; correctOption: string; marks: number
  labelEvidence: string; marksEvidence: string
}
export interface ExamSection { title: string; instructions: string; questions: ExamQuestion[] }
export interface ExamDraft {
  sourceName: string; examEvidence: string; durationMinutes: number; durationEvidence: string
  totalQuestions: number; totalMarks: number; totalsEvidence: string; instructions: string
  sections: ExamSection[]
}
const normal = (s: string) => s.replace(/\s+/g, " ").trim()
function fail(message: string): never { throw new RecreationInputError(`Mock exam unavailable: ${message}`) }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("the paper structure could not be read.")
  return value as Record<string, unknown>
}
function text(value: unknown): string { if (typeof value !== "string") fail("some paper details are missing."); return value.trim() }
function integer(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > max) fail("a count, mark allocation or duration is missing or unsupported.")
  return value
}

/** Fail closed. We only reproduce compulsory, equally weighted MCQ papers; never convert essays or optional sections. */
export function validateExamDraft(value: unknown, source: PaperSource): ExamDraft {
  const d = record(value)
  if (d.isExam !== true || d.supported !== true) fail(typeof d.reason === "string" ? d.reason : "no complete supported previous exam was found.")
  const evidence = (value: unknown, optional = false) => {
    const quote = text(value)
    if ((!quote && !optional) || (quote && !normal(source.text).includes(normal(quote)))) fail("a structural detail cannot be verified against the uploaded paper.")
    return quote
  }
  const examEvidence = evidence(d.examEvidence)
  if (!/exam(?:ination)?/i.test(examEvidence)) fail("the selected document is not identifiable as a previous exam.")
  const durationMinutes = integer(d.durationMinutes, 480)
  const durationEvidence = evidence(d.durationEvidence)
  const durationText = normal(durationEvidence).toLowerCase()
  const durations = [...durationText.matchAll(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|hours?|hrs?)/g)].map(m => Number(m[1]) * (/^(?:h)/.test(m[2]) ? 60 : 1))
  if (!durations.includes(durationMinutes)) fail("the duration does not match its source evidence.")
  const totalQuestions = integer(d.totalQuestions, 100)
  const totalMarks = integer(d.totalMarks, 1000)
  const totalsEvidence = evidence(d.totalsEvidence)
  if (!totalsEvidence.includes(String(totalQuestions)) || !totalsEvidence.includes(String(totalMarks))) fail("question or mark totals cannot be verified.")
  const instructions = evidence(d.instructions)
  if (!/all\s+(?:the\s+)?questions|every question/i.test(instructions) || /answer\s+(?:any|only)|choose\s+(?:any|\d)|negative mark|penalt/i.test(instructions)) fail("optional questions or special scoring cannot be reproduced faithfully.")
  if (!Array.isArray(d.sections) || !d.sections.length || d.sections.length > 20) fail("the sections are missing.")
  const labels = new Set<string>()
  let previousPosition = -1
  const sections = d.sections.map(value => {
    const section = record(value)
    const title = evidence(section.title, d.sections instanceof Array && d.sections.length === 1)
    const sectionInstructions = evidence(section.instructions ?? "", true)
    if (/answer\s+(?:any|only)|choose\s+(?:any|\d)/i.test(sectionInstructions)) fail("optional sections are not supported.")
    if (!Array.isArray(section.questions) || !section.questions.length) fail("a section has no questions.")
    const questions = section.questions.map(value => {
      const q = record(value)
      if (q.kind !== "mcq") fail("written answers, essays and other question types cannot be converted into multiple choice.")
      const label = text(q.label)
      const labelEvidence = evidence(q.labelEvidence)
      if (!/^\d+$/.test(label) || labels.has(label) || !labelEvidence.includes(label)) fail("question numbering is incomplete or duplicated.")
      labels.add(label)
      const question = evidence(q.question)
      const position = normal(source.text).indexOf(normal(labelEvidence))
      if (position <= previousPosition) fail("question order does not match the previous exam.")
      previousPosition = position
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) fail("answer options are incomplete.")
      const options = q.options.map(option => evidence(option))
      if (new Set(options).size !== options.length) fail("answer options are duplicated.")
      const correctOption = text(q.correctOption)
      if (!options.includes(correctOption)) fail("a correct answer could not be established.")
      const marks = integer(q.marks, 100)
      const marksEvidence = evidence(q.marksEvidence)
      if (!marksEvidence.includes(String(marks))) fail("question marks cannot be verified.")
      return { label, question, options, correctOption, marks, labelEvidence, marksEvidence }
    })
    return { title, instructions: sectionInstructions, questions }
  })
  const questions = sections.flatMap(s => s.questions)
  const sourceText = normal(source.text)
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    const start = sourceText.indexOf(normal(q.labelEvidence))
    const end = i + 1 < questions.length ? sourceText.indexOf(normal(questions[i + 1].labelEvidence)) : sourceText.length
    const block = sourceText.slice(start, end)
    let cursor = block.indexOf(normal(q.question))
    if (cursor < 0) fail("a question is not in its original numbered position.")
    cursor += normal(q.question).length
    for (const option of q.options) {
      const at = block.indexOf(normal(option), cursor)
      if (at < 0) fail("answer options do not match their original question and order.")
      cursor = at + normal(option).length
    }
  }
  if (questions.length !== totalQuestions || questions.reduce((n, q) => n + q.marks, 0) !== totalMarks) fail("question counts or marks do not add up to the paper totals.")
  if (new Set(questions.map(q => q.marks)).size !== 1) fail("unequal question weights are not supported by the current quiz runner.")
  return { sourceName: source.name, examEvidence, durationMinutes, durationEvidence, totalQuestions, totalMarks, totalsEvidence, instructions, sections }
}

export function examValidationPayload(exam: ExamDraft) {
  return { ...exam, isExam: true, supported: true, sections: exam.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, kind: "mcq" })) })) }
}
