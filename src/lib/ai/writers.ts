import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT } from "@/lib/ai/unisa"

/**
 * The AI lesson writer and question writer, shared by the "Write with AI" /
 * "Generate questions" buttons and the textbook import.
 */

// ---------------------------------------------------------------- lessons

export type Length = "short" | "standard" | "detailed"

export const LENGTH_GUIDE: Record<Length, string> = {
  short: "about 400–600 words",
  standard: "about 900–1,300 words",
  detailed: "about 1,800–2,500 words",
}

export const LESSON_SYSTEM_PROMPT = `You are an experienced lecturer writing study material for students at UNISA (the University of South Africa).

${UNISA_CONTEXT}
- Define every technical term the first time it appears.

What to write: the lesson for ONE topic, written for the student ("you").
Spend the words on teaching. Start straight away with the first concept (one or two sentences of context at most):
- NO introduction or overview ("In this topic you will learn…", "This lesson covers…", "By the end of this topic…", "Welcome to…").
- NO learning outcomes or objectives, and NO "Key idea" or summary-of-what's-coming box at the start.
Structure:
1. The main teaching, split under clear headings (<h2>) and subheadings (<h3>), from basics to harder ideas, each with at least one fully worked example (show every step).
2. "Watch out" boxes for common mistakes students make in exams and assignments, placed where the mistake happens.
3. A short summary list at the end, then 2–4 self-check questions (questions only, no answers) under a heading "Check your understanding".

Formatting: return HTML using ONLY these tags: <h2> <h3> <p> <strong> <em> <ul> <ol> <li> <blockquote> <pre> <code> <table> <thead> <tbody> <tr> <th> <td> <hr> <div class="callout">, <div class="callout callout-tip">, <div class="callout callout-warning">.
- Callout boxes (use sparingly, inside the teaching, never as an opener): <div class="callout"><p><strong>Remember:</strong> …</p></div> for a rule or formula worth memorising, <div class="callout callout-tip"><p><strong>Tip:</strong> …</p></div>, <div class="callout callout-warning"><p><strong>Watch out:</strong> …</p></div>
- Code goes in <pre><code>…</code></pre> with < and > escaped as &lt; &gt;.
- Matrices: write them inline as [[1, 2], [3, 4]] (rows in brackets); the app draws them as matrices. Other maths: plain text such as x^2, √x, ≤, × (the app shows x^2 as a superscript). Equations go in <p>, never in <pre> or <code> - those are only for program code.
- No <h1> (the topic title is already shown), no inline styles, no images, no links, no markdown.

Respond with JSON only: { "html": "<the lesson HTML>" }`

const INTRO_PHRASES =
  /^(?:\s|<[^>]+>)*(?:in this (?:topic|lesson|section|unit|chapter)|this (?:topic|lesson|section|unit) (?:covers|introduces|explains|will|looks)|by the end of this|after (?:this|completing this) (?:topic|lesson)|welcome to|you will learn|we will (?:learn|look at|explore))/i
const OUTCOME_BOX = /^(?:\s|<[^>]+>)*(?:key ideas?|learning outcomes?|outcomes|objectives|what you(?:'|’)ll learn|in this topic)\s*:?/i

/**
 * Safety net for the "no intro, no outcomes box" rule: drop an opening
 * paragraph like "In this topic you will learn…" and any Key idea / outcomes
 * box that comes before the first heading. Teaching content is left alone.
 */
export function trimLessonPreamble(html: string): string {
  const firstHeading = html.search(/<h[23][\s>]/i)
  if (firstHeading <= 0) return html
  let head = html.slice(0, firstHeading)
  const rest = html.slice(firstHeading)
  head = head.replace(/<div class="callout[^"]*">[\s\S]*?<\/div>/gi, box => (OUTCOME_BOX.test(box.replace(/^<div[^>]*>/i, "")) ? "" : box))
  head = head.replace(/<p>[\s\S]*?<\/p>/gi, para => (INTRO_PHRASES.test(para) ? "" : para))
  return (head.trim() ? head.trim() + "\n" : "") + rest
}

/** Write a lesson from a prompt describing the topic; returns the lesson HTML */
export async function writeLessonHtml(userPrompt: string): Promise<string> {
  // Detailed lessons are ~2,500 words of HTML: leave plenty of room
  const parsed = await chatJson<{ html?: unknown }>({ system: LESSON_SYSTEM_PROMPT, user: userPrompt, temperature: 0.5, maxTokens: 12000 })
  const html = typeof parsed.html === "string"
    ? parsed.html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim()
    : ""
  if (!html) throw new Error("The AI didn't return any lesson content")

  return trimLessonPreamble(html) || html
}

// ---------------------------------------------------------------- questions

export type Difficulty = "easy" | "medium" | "hard"
export type DifficultyChoice = Difficulty | "mixed"

export interface GeneratedQuestion {
  question: string
  options: string[]
  correctOption: string
  difficulty: Difficulty
  explanation?: string
}

export const DIFFICULTY_GUIDE: Record<DifficultyChoice, string> = {
  mixed: "a mix: roughly 30% easy (recall and definitions), 50% medium (understanding and applying), 20% hard (analysing, tracing, multi-step problems)",
  easy: "easy: recall of facts, definitions and basic concepts",
  medium: "medium: understanding and applying concepts to short examples",
  hard: "hard: analysing, tracing code or working multi-step problems, distinguishing closely related ideas",
}

export const QUESTIONS_SYSTEM_PROMPT = `You are an experienced UNISA lecturer and examiner writing multiple-choice questions for a module's online quizzes.

${UNISA_CONTEXT}

Write questions like a good UNISA MCQ assignment or exam paper:
- Each question tests ONE clear idea from the material and has exactly 4 options with exactly ONE correct answer.
- Wrong options (distractors) must be plausible (based on real misconceptions and common mistakes), not silly or obviously wrong. Keep all options a similar length and style.
- Do not use "All of the above", "None of the above" or "Both A and B". Avoid negative wording ("Which is NOT…") unless it is essential, and then write NOT in capitals.
- The question must make sense on its own (the quiz shows questions in random order), so don't refer to "the passage", "the text above" or other questions.
- Options are shuffled in the quiz, so never refer to option letters or positions.
- Code: put it in the question as plain text with line breaks (no markdown). Matrices: write them as [[1, 2], [3, 4]]; the app draws them as matrices.
- Cover the material broadly instead of asking several questions about the same detail, and never repeat or closely rephrase an existing question you are given.
- Give a one-sentence explanation of why the answer is correct.

Respond with JSON only:
{ "questions": [ { "question": "…", "options": ["…", "…", "…", "…"], "correctOption": "exact text of the correct option", "difficulty": "easy" | "medium" | "hard", "explanation": "…" } ] }`

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

/**
 * Write multiple-choice questions from a prompt. Drops malformed questions
 * and repeats of `existing`; may return an empty list.
 */
export async function writeQuestions(userPrompt: string, existing: string[], difficulty: DifficultyChoice): Promise<GeneratedQuestion[]> {
  const parsed = await chatJson<{ questions?: unknown }>({ system: QUESTIONS_SYSTEM_PROMPT, user: userPrompt, temperature: 0.6, maxTokens: 8000 })
  if (!Array.isArray(parsed.questions)) throw new Error("Invalid AI response")

  // Keep only well-formed questions that aren't duplicates
  const seen = new Set(existing.map(normalise))
  const questions: GeneratedQuestion[] = []
  for (const item of parsed.questions as Record<string, unknown>[]) {
    const question = typeof item?.question === "string" ? item.question.trim() : ""
    const options = Array.isArray(item?.options)
      ? [...new Set(item.options.map(o => String(o).trim()).filter(Boolean))]
      : []
    const correctOption = typeof item?.correctOption === "string" ? item.correctOption.trim() : ""
    const level = ["easy", "medium", "hard"].includes(String(item?.difficulty))
      ? (item.difficulty as Difficulty)
      : difficulty === "mixed" ? "medium" : difficulty
    const key = normalise(question)
    if (!question || options.length < 2 || !options.includes(correctOption) || seen.has(key)) continue
    seen.add(key)
    questions.push({
      question,
      options,
      correctOption,
      difficulty: level,
      explanation: typeof item.explanation === "string" ? item.explanation.trim() : undefined,
    })
  }

  return questions
}
