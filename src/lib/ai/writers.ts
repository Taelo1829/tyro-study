import { chatJson } from "@/lib/ai/openai"
import { UNISA_CONTEXT } from "@/lib/ai/unisa"
import { resolveLessonDiagrams } from "@/lib/ai/diagrams"

/**
 * The AI lesson writer and question writer, shared by the "Write with AI" /
 * "Generate questions" buttons and the textbook import.
 */

// ---------------------------------------------------------------- lessons

export type Length = "short" | "standard" | "detailed"

export const LENGTH_GUIDE: Record<Length, string> = {
  short: "about 400–600 words",
  standard: "about 900–1,300 words",
  detailed: "about 3,500–4,500 words",
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
   Labelled diagrams: when the topic teaches a physical structure students must be able to identify and label (an organ such as the eye, heart, ear, kidney or brain; a cell or organelle; a flower, leaf, root or seed; a tooth, a nephron, a joint, a neuron; lab apparatus or a geological/geographical feature), place a diagram marker right where the text first describes that structure - not at the end. Use at most 3 markers per lesson, only where a picture genuinely helps, and none for maths, code, accounting or other topics without a physical structure.
   Marker format (exactly): <div class="diagram" data-search="human eye labelled diagram">The structure of the human eye</div> - data-search is a short English search for a labelled diagram on Wikimedia Commons (name the structure plus "labelled diagram" or "anatomy"); the text inside is the caption.
   A real diagram is inserted at the marker later, but sometimes none is found, so the text must still make complete sense on its own: describe every part in words, and never refer to labels, letters or numbers in the picture.
3. A short summary list at the end, then 2–4 self-check questions (questions only, no answers) under a heading "Check your understanding".

Formatting: return HTML using ONLY these tags: <h2> <h3> <p> <strong> <em> <ul> <ol> <li> <blockquote> <pre> <code> <table> <thead> <tbody> <tr> <th> <td> <hr> <div class="callout">, <div class="callout callout-tip">, <div class="callout callout-warning">, and diagram markers (<div class="diagram" data-search="…">caption</div>).
- Callout boxes (use sparingly, inside the teaching, never as an opener): <div class="callout"><p><strong>Remember:</strong> …</p></div> for a rule or formula worth memorising, <div class="callout callout-tip"><p><strong>Tip:</strong> …</p></div>, <div class="callout callout-warning"><p><strong>Watch out:</strong> …</p></div>
- Code goes in <pre><code>…</code></pre> with < and > escaped as &lt; &gt;.
- Matrices: write them inline as [[1, 2], [3, 4]] (rows in brackets); the app draws them as matrices. Other maths: plain text such as x^2, x_1, √x, ≤, × (the app shows x^2 as a superscript and x_1 or a_{ij} as subscripts; never write x1 when you mean x with subscript 1). Follow the module's notation line. Fractions: a/b, 3/4, x^2/y or (a+b)/(c-d) with brackets round longer parts (the app draws them as a numerator over a denominator); never \frac or LaTeX. Equations go in <p>, never in <pre> or <code> - those are only for program code.
- No <h1> (the topic title is already shown), no inline styles, no <img> tags (use diagram markers instead), no links, no markdown.

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
  // Detailed lessons are ~4,000 words of HTML (about 10k tokens): leave plenty
  // of room, up to gpt-4o-mini's 16,384-token output limit
  const parsed = await chatJson<{ html?: unknown }>({ system: LESSON_SYSTEM_PROMPT, user: userPrompt, temperature: 0.5, maxTokens: 16000 })
  const html = typeof parsed.html === "string"
    ? parsed.html.replace(/^```(?:html)?\s*/i, "").replace(/```\s*$/, "").trim()
    : ""
  if (!html) throw new Error("The AI didn't return any lesson content")

  const lesson = trimLessonPreamble(html) || html
  // Swap diagram markers for real labelled diagrams from Wikimedia Commons,
  // picked by the AI (markers with no good match are dropped)
  try {
    return await resolveLessonDiagrams(lesson, userPrompt)
  } catch (error) {
    console.warn("Diagram step failed, saving the lesson without diagrams:", error)
    return lesson.replace(/<div\b[^>]*class=["']diagram["'][^>]*>[\s\S]*?<\/div>/gi, "")
  }
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
- Code: put it in the question as plain text with line breaks (no markdown). Matrices: write them as [[1, 2], [3, 4]]; the app draws them as matrices. Fractions: 3/4, x/y or (a+b)/(c-d); the app stacks them. Subscripts: x_1, a_{ij} (never x1 for x-sub-1); powers: x^2. Follow the module's notation line.
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

// ---------------------------------------------------------------- flashcards

export const FLASHCARDS_SYSTEM_PROMPT = `You are an experienced UNISA lecturer making revision flashcards for one topic of a module.

${UNISA_CONTEXT}

Flashcards:
- Cover the key definitions, terms, facts, rules and concepts a student must remember for this topic, taken from the lesson you are given.
- Front: a short question or a term (under 20 words). Back: a clear, complete answer in plain text (under 45 words).
- One idea per card, no repeats, and every card must make sense on its own.
- Plain text only: no HTML or markdown. Write matrices as [[1, 2], [3, 4]], fractions as 3/4, x/y or (a+b)/(c-d), subscripts as x_1 or a_{ij} and powers as x^2.

Respond with JSON only: { "flashcards": [ { "front": "…", "back": "…" } ] }`

/** Write revision flashcards from a prompt; drops empty and repeated cards */
export async function writeFlashcards(userPrompt: string, count: number): Promise<{ front: string; back: string }[]> {
  const parsed = await chatJson<{ flashcards?: unknown }>({
    system: FLASHCARDS_SYSTEM_PROMPT,
    user: `${userPrompt}\n\nWrite ${count} flashcards.`,
    temperature: 0.4,
    maxTokens: 4000,
  })
  if (!Array.isArray(parsed.flashcards)) throw new Error("Invalid AI response")
  const seen = new Set<string>()
  const cards: { front: string; back: string }[] = []
  for (const item of parsed.flashcards as Record<string, unknown>[]) {
    const front = typeof item?.front === "string" ? item.front.replace(/—/g, ", ").trim() : ""
    const back = typeof item?.back === "string" ? item.back.replace(/—/g, ", ").trim() : ""
    const key = normalise(front)
    if (!front || !back || seen.has(key)) continue
    seen.add(key)
    cards.push({ front: front.slice(0, 500), back: back.slice(0, 1500) })
  }
  return cards.slice(0, count)
}
