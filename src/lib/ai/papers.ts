import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT, moduleLines } from "@/lib/ai/unisa"

/**
 * Question papers: read a past exam or assignment paper and turn every
 * question into a multiple-choice question for the module's quizzes,
 * matched to the topic it tests.
 */

export interface PaperQuestion {
  /** As numbered on the paper, e.g. "Question 3(b)" */
  number: string
  question: string
  options: string[]
  correctOption: string
  /** "paper": the paper's own options and memo answer; "worked out": the AI made the options or worked out the answer */
  answerSource: "paper" | "worked out"
  difficulty: "easy" | "medium" | "hard"
  topicId: string | null
}

const PROMPT = `You turn a UNISA past exam or assignment paper into multiple-choice quiz questions for the module's question bank.

${UNISA_CONTEXT}

For every question on the paper (split questions with parts into one quiz question per part):
- number: as numbered on the paper, e.g. "Question 3(b)" or "Q12".
- question: the paper's wording, kept faithful (fix only obvious OCR or text-extraction slips). It must make sense on its own, so include any shared information a part needs (the matrix, the system of equations, the scenario). Follow the module's notation line. Drop mark allocations like "(5)".
- If the paper gives options (a multiple-choice question), keep them exactly, as "options".
- If it's a written question, turn it into a multiple-choice question: the correct final answer plus 3 plausible wrong answers built from common mistakes. For "show that" / "prove" questions ask for the key result or step instead.
- correctOption: exactly one of the options. Use the memorandum's answer when the paper includes one; otherwise work it out carefully.
- answerSource: "paper" when the options and answer both come from the paper/memo, otherwise "worked out".
- difficulty: "easy", "medium" or "hard".
- topicId: the id of the module topic (from the list) this question tests most; null if none fits.
- Skip cover-page instructions, the memo itself as a separate question, and anything that isn't a question.

Respond with JSON only: { "paper": "a short name for the paper, e.g. Oct/Nov 2023 exam", "questions": [ { "number": "…", "question": "…", "options": ["…"], "correctOption": "…", "answerSource": "paper", "difficulty": "medium", "topicId": "…" } ] }`

const CHUNK_CHARS = 18_000

export async function questionsFromPaper(input: {
  pages: string[]
  module: { title: string; description: string | null }
  topics: { id: string; label: string }[]
}): Promise<{ paper: string; questions: PaperQuestion[] }> {
  // Long papers go in parts (whole pages per part) so nothing is cut off
  const chunks: string[] = []
  let current = ""
  input.pages.forEach((text, i) => {
    const page = `[Page ${i + 1}]\n${text}\n`
    if (current && current.length + page.length > CHUNK_CHARS) {
      chunks.push(current)
      current = ""
    }
    current += page
  })
  if (current.trim()) chunks.push(current)

  const topicIds = new Set(input.topics.map(t => t.id))
  const topicList = input.topics.map(t => `${t.id}: ${t.label}`).join("\n")
  let paperName = ""
  const out: PaperQuestion[] = []

  for (const [i, chunk] of chunks.entries()) {
    const user = [
      ...moduleLines(input.module),
      `\nThe module's topics (id: chapter / topic):\n${topicList || "(none yet)"}`,
      chunks.length > 1 ? `\nThis is part ${i + 1} of ${chunks.length} of the paper. Questions already taken from earlier parts: ${out.map(q => q.number).join(", ") || "none"}.` : "",
      `\nThe paper:\n${chunk}`,
    ].join("\n")
    const parsed = await chatJson<{ paper?: unknown; questions?: unknown }>({ system: PROMPT, user, temperature: 0.2, maxTokens: 12000 })
    if (!paperName && typeof parsed.paper === "string") paperName = parsed.paper.trim().slice(0, 120)
    for (const q of (Array.isArray(parsed.questions) ? parsed.questions : []) as Record<string, unknown>[]) {
      const question = typeof q?.question === "string" ? q.question.replace(/—/g, ", ").trim() : ""
      const options = Array.isArray(q?.options) ? [...new Set(q.options.map(o => String(o).replace(/—/g, ", ").trim()).filter(Boolean))].slice(0, 6) : []
      const correctOption = typeof q?.correctOption === "string" ? q.correctOption.replace(/—/g, ", ").trim() : ""
      if (!question || options.length < 2 || !options.includes(correctOption)) continue
      if (out.some(o => o.question === question)) continue
      out.push({
        number: String(q.number ?? "").trim().slice(0, 40) || `Q${out.length + 1}`,
        question,
        options,
        correctOption,
        answerSource: q.answerSource === "paper" ? "paper" : "worked out",
        difficulty: q.difficulty === "easy" || q.difficulty === "hard" ? q.difficulty : "medium",
        topicId: typeof q.topicId === "string" && topicIds.has(q.topicId) ? q.topicId : null,
      })
    }
  }
  return { paper: paperName, questions: out }
}
